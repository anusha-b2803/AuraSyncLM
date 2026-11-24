"""
MMLF Semantic Cache Layer
==========================
Multi-tier caching system for the MMLF pipeline to eliminate redundant LLM calls.

Cache Hierarchy:
  1. Exact-match LRU cache (hash-based, O(1) lookup)
  2. Semantic fuzzy-match cache (cosine similarity on cached query embeddings)
  3. TTL-based expiry to prevent stale results

Cached Artifacts:
  - Sub-queries   (query → List[str])
  - Passages       (query+sub_query → str)
  - Full pipeline results (query → MMLF result dict)
"""

import os
import time
import json
import hashlib
import logging
import threading
from collections import OrderedDict
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Persistent cache directory
_CACHE_DIR = os.path.join(os.path.expanduser("~"), ".aurasync-lm", "mmlf_cache")


class SemanticLRUCache:
    """
    Thread-safe LRU cache with optional semantic fuzzy matching.
    
    Features:
      - O(1) exact-match via hash key
      - Optional cosine-similarity fuzzy match for near-duplicate queries
      - Per-entry TTL expiry
      - Configurable max size with LRU eviction
      - Persistent disk backup for warm restarts
    """

    def __init__(
        self,
        name: str = "default",
        max_size: int = 512,
        ttl_seconds: int = 3600,
        semantic_threshold: float = 0.92,
        persist: bool = True
    ):
        self.name = name
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.semantic_threshold = semantic_threshold
        self.persist = persist

        self._lock = threading.Lock()
        # OrderedDict for LRU: key → (value, timestamp, embedding)
        self._cache: OrderedDict[str, Tuple[Any, float, Optional[List[float]]]] = OrderedDict()
        self._hits = 0
        self._misses = 0
        self._semantic_hits = 0

        # Load from disk on init
        if persist:
            self._load_from_disk()

    def _hash_key(self, key: str) -> str:
        """Create a deterministic hash for exact matching."""
        return hashlib.sha256(key.strip().lower().encode("utf-8")).hexdigest()[:24]

    def get(self, key: str, embedding: Optional[List[float]] = None) -> Optional[Any]:
        """
        Retrieve from cache. Tries exact match first, then semantic fuzzy match.
        
        Args:
            key: The query string
            embedding: Optional pre-computed embedding for semantic matching
            
        Returns:
            Cached value or None
        """
        with self._lock:
            hashed = self._hash_key(key)

            # Strategy 1: Exact match
            if hashed in self._cache:
                value, ts, _ = self._cache[hashed]
                if time.time() - ts < self.ttl_seconds:
                    self._cache.move_to_end(hashed)
                    self._hits += 1
                    logger.debug(f"[Cache:{self.name}] Exact HIT for '{key[:50]}...'")
                    return value
                else:
                    # Expired entry
                    del self._cache[hashed]

            # Strategy 2: Semantic fuzzy match (if embedding provided)
            if embedding is not None and len(self._cache) > 0:
                best_score = 0.0
                best_key = None
                best_value = None

                for cached_key, (value, ts, cached_emb) in self._cache.items():
                    if cached_emb is None:
                        continue
                    if time.time() - ts >= self.ttl_seconds:
                        continue

                    sim = self._cosine_similarity(embedding, cached_emb)
                    if sim > best_score:
                        best_score = sim
                        best_key = cached_key
                        best_value = value

                if best_score >= self.semantic_threshold:
                    self._cache.move_to_end(best_key)
                    self._semantic_hits += 1
                    self._hits += 1
                    logger.info(
                        f"[Cache:{self.name}] Semantic HIT (sim={best_score:.3f}) "
                        f"for '{key[:50]}...'"
                    )
                    return best_value

            self._misses += 1
            return None

    def put(self, key: str, value: Any, embedding: Optional[List[float]] = None):
        """Store a value in the cache with optional embedding for semantic matching."""
        with self._lock:
            hashed = self._hash_key(key)

            # Evict LRU if at capacity
            while len(self._cache) >= self.max_size:
                self._cache.popitem(last=False)

            self._cache[hashed] = (value, time.time(), embedding)
            self._cache.move_to_end(hashed)

        # Async persist to disk
        if self.persist:
            self._save_to_disk_async()

    def invalidate(self, key: str):
        """Remove a specific key from cache."""
        with self._lock:
            hashed = self._hash_key(key)
            self._cache.pop(hashed, None)

    def clear(self):
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
            self._semantic_hits = 0
        if self.persist:
            self._delete_from_disk()

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        with self._lock:
            total = self._hits + self._misses
            hit_rate = (self._hits / total * 100) if total > 0 else 0.0
            return {
                "name": self.name,
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "semantic_hits": self._semantic_hits,
                "hit_rate_pct": round(hit_rate, 1),
                "ttl_seconds": self.ttl_seconds,
            }

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors without numpy dependency."""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _disk_path(self) -> str:
        return os.path.join(_CACHE_DIR, f"{self.name}_cache.json")

    def _save_to_disk_async(self):
        """Non-blocking disk persist via daemon thread."""
        def _write():
            try:
                os.makedirs(_CACHE_DIR, exist_ok=True)
                with self._lock:
                    # Only persist key → (value, timestamp). Skip embeddings for size.
                    serializable = {}
                    for k, (v, ts, _emb) in self._cache.items():
                        try:
                            json.dumps(v)  # Check serializability
                            serializable[k] = {"value": v, "timestamp": ts}
                        except (TypeError, ValueError):
                            continue

                with open(self._disk_path(), "w", encoding="utf-8") as f:
                    json.dump(serializable, f, ensure_ascii=False)
            except Exception as e:
                logger.debug(f"[Cache:{self.name}] Disk persist failed: {e}")

        t = threading.Thread(target=_write, daemon=True)
        t.start()

    def _load_from_disk(self):
        """Load cached entries from disk on startup."""
        path = self._disk_path()
        if not os.path.exists(path):
            return
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            now = time.time()
            loaded = 0
            for k, entry in data.items():
                ts = entry.get("timestamp", 0)
                if now - ts < self.ttl_seconds:
                    self._cache[k] = (entry["value"], ts, None)
                    loaded += 1

            if loaded > 0:
                logger.info(f"[Cache:{self.name}] Warm-loaded {loaded} entries from disk.")
        except Exception as e:
            logger.debug(f"[Cache:{self.name}] Disk load failed: {e}")

    def _delete_from_disk(self):
        """Delete persistent cache file."""
        try:
            path = self._disk_path()
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


# ── Singleton Cache Instances ─────────────────────────────────────────────────

_subquery_cache: Optional[SemanticLRUCache] = None
_passage_cache: Optional[SemanticLRUCache] = None
_pipeline_cache: Optional[SemanticLRUCache] = None


def get_subquery_cache() -> SemanticLRUCache:
    """Cache for Stage 1: query → sub-queries mapping."""
    global _subquery_cache
    if _subquery_cache is None:
        from mmlf_optimizer_config import get_config
        cfg = get_config()
        _subquery_cache = SemanticLRUCache(
            name="subquery",
            max_size=cfg.cache_max_size,
            ttl_seconds=cfg.cache_ttl_seconds,
            semantic_threshold=cfg.cache_semantic_threshold,
        )
    return _subquery_cache


def get_passage_cache() -> SemanticLRUCache:
    """Cache for Stage 2: (query + sub_query) → passage mapping."""
    global _passage_cache
    if _passage_cache is None:
        from mmlf_optimizer_config import get_config
        cfg = get_config()
        _passage_cache = SemanticLRUCache(
            name="passage",
            max_size=cfg.cache_max_size * 2,
            ttl_seconds=cfg.cache_ttl_seconds,
            semantic_threshold=cfg.cache_semantic_threshold,
        )
    return _passage_cache


def get_pipeline_cache() -> SemanticLRUCache:
    """Cache for full pipeline results: query → MMLF result dict."""
    global _pipeline_cache
    if _pipeline_cache is None:
        from mmlf_optimizer_config import get_config
        cfg = get_config()
        _pipeline_cache = SemanticLRUCache(
            name="pipeline",
            max_size=cfg.cache_max_size // 2,
            ttl_seconds=cfg.cache_ttl_seconds,
            semantic_threshold=cfg.cache_semantic_threshold,
        )
    return _pipeline_cache


def get_all_cache_stats() -> Dict[str, Any]:
    """Return statistics for all cache tiers."""
    return {
        "subquery": get_subquery_cache().stats(),
        "passage": get_passage_cache().stats(),
        "pipeline": get_pipeline_cache().stats(),
    }


def clear_all_caches():
    """Flush all MMLF caches (memory + disk)."""
    get_subquery_cache().clear()
    get_passage_cache().clear()
    get_pipeline_cache().clear()
    logger.info("[Cache] All MMLF caches cleared.")
