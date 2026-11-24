"""
Cache Manager: Stage 2 of Adaptive MMLF Pipeline
High-performance in-memory cache keyed by MD5 of normalized queries with TTL,
LRU/oldest eviction (10% bulk eviction on reaching max_size), hit counting, and size tracking.
"""

import hashlib
import json
import time
import sys
import threading
from typing import Any, Dict, Optional


class CacheEntry:
    def __init__(self, value: Any, ttl_seconds: float):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl_seconds
        self.last_accessed = self.created_at
        self.hit_count = 0

    def is_expired(self) -> bool:
        if self.ttl <= 0:
            return False
        return (time.time() - self.created_at) > self.ttl


class CacheManager:
    """
    Thread-safe query result cache manager.
    - Key: MD5 hash of lowercase trimmed query string
    - TTL: Configurable, default 3600s
    - Eviction: When size >= max_size, evicts oldest 10%
    - Statistics: cached_queries, total_hits, cache_size_mb
    """

    def __init__(self, ttl: float = 3600.0, max_size: int = 500):
        self.ttl = float(ttl)
        self.max_size = int(max_size)
        self.cache: Dict[str, CacheEntry] = {}
        self.total_hits = 0
        self.total_misses = 0
        self.lock = threading.RLock()

    @staticmethod
    def normalize_query(query: str) -> str:
        """Normalizes query to stripped lowercase."""
        if not query:
            return ""
        return query.strip().lower()

    @classmethod
    def generate_key(cls, query: str) -> str:
        """Generates MD5 hash of normalized query."""
        normalized = cls.normalize_query(query)
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()

    def get(self, query: str) -> Optional[Any]:
        """
        Retrieves result for query. Returns None if missing or expired.
        Automatically removes expired entries and updates hit counts.
        """
        key = self.generate_key(query)
        with self.lock:
            entry = self.cache.get(key)
            if entry is None:
                self.total_misses += 1
                return None

            if entry.is_expired():
                # Expired: remove and return None
                del self.cache[key]
                self.total_misses += 1
                return None

            entry.last_accessed = time.time()
            entry.hit_count += 1
            self.total_hits += 1
            return entry.value

    def set(self, query: str, value: Any) -> None:
        """
        Stores query result in cache.
        Evicts oldest 10% of entries if max_size is reached.
        """
        key = self.generate_key(query)
        with self.lock:
            # Check eviction if new key and at capacity
            if key not in self.cache and len(self.cache) >= self.max_size:
                self._evict_oldest()

            self.cache[key] = CacheEntry(value=value, ttl_seconds=self.ttl)

    def _evict_oldest(self) -> None:
        """Evicts oldest 10% of entries based on created_at / last_accessed."""
        if not self.cache:
            return

        evict_count = max(1, int(self.max_size * 0.10))
        # Sort keys by created_at (oldest first)
        sorted_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k].created_at)

        for k in sorted_keys[:evict_count]:
            self.cache.pop(k, None)

    def clear(self) -> None:
        """Clears all entries and resets stats."""
        with self.lock:
            self.cache.clear()
            self.total_hits = 0
            self.total_misses = 0

    def get_stats(self) -> Dict[str, Any]:
        """
        Returns real-time cache statistics:
        - cached_queries: int
        - total_hits: int
        - cache_size_mb: float
        """
        with self.lock:
            # Clean expired first to give accurate count
            now = time.time()
            expired_keys = [k for k, v in self.cache.items() if (v.ttl > 0 and (now - v.created_at) > v.ttl)]
            for k in expired_keys:
                del self.cache[k]

            cached_count = len(self.cache)
            # Estimate memory in MB
            approx_bytes = 0
            for k, entry in self.cache.items():
                approx_bytes += sys.getsizeof(k) + sys.getsizeof(entry)
                try:
                    approx_bytes += len(json.dumps(entry.value, default=str))
                except Exception:
                    approx_bytes += sys.getsizeof(entry.value)

            cache_size_mb = round(approx_bytes / (1024 * 1024), 4)

            return {
                "cached_queries": cached_count,
                "total_cached_queries": cached_count,
                "total_hits": self.total_hits,
                "total_misses": self.total_misses,
                "cache_size_mb": cache_size_mb
            }
