"""
MMLF Optimizer Configuration
=============================
Central hub for all tunable parameters controlling MMLF pipeline optimizations.
Provides three preset profiles and fine-grained overrides.

Profiles:
  - 'fast'      : Minimum latency. Aggressive caching, fewer sub-queries, FAISS ANN.
  - 'balanced'  : Default. Good quality/speed tradeoff with all optimizations active.
  - 'quality'   : Maximum retrieval quality. Full expansion, less aggressive pruning.
"""

import os
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional

logger = logging.getLogger(__name__)

# Persistent config path
_CONFIG_DIR = os.path.join(os.path.expanduser("~"), ".aurasync-lm")
_CONFIG_PATH = os.path.join(_CONFIG_DIR, "optimizer_config.json")


@dataclass
class MMLFOptimizerConfig:
    """All tunable parameters for the optimized MMLF pipeline."""

    # ── Profile Name ──────────────────────────────────────────────────────────
    profile: str = "balanced"

    # ── Caching ───────────────────────────────────────────────────────────────
    cache_enabled: bool = True
    cache_max_size: int = 512              # Max entries in LRU cache
    cache_ttl_seconds: int = 3600          # TTL per cache entry (1 hour)
    cache_semantic_threshold: float = 0.92 # Cosine similarity for fuzzy cache hits

    # ── Parallelism ───────────────────────────────────────────────────────────
    parallel_generation: bool = True       # Parallel pseudo-passage generation
    parallel_retrieval: bool = True        # Parallel multi-list retrieval
    max_workers: int = 4                   # ThreadPoolExecutor worker count

    # ── Adaptive Sub-query Count ──────────────────────────────────────────────
    adaptive_subquery_enabled: bool = True
    min_subqueries: int = 2
    max_subqueries: int = 5
    # Word-count thresholds for complexity tiers
    simple_query_max_words: int = 4
    medium_query_max_words: int = 10

    # ── Dynamic Stopping ──────────────────────────────────────────────────────
    dynamic_stopping_enabled: bool = True
    # If a new sub-query's cosine similarity to ANY existing sub-query exceeds
    # this threshold, it is considered redundant and generation stops early.
    stopping_similarity_threshold: float = 0.85

    # ── Retrieval Optimizations ───────────────────────────────────────────────
    faiss_enabled: bool = True             # Use FAISS ANN index for fast search
    faiss_nprobe: int = 32                 # HNSW ef_search parameter
    bm25_prefilter_enabled: bool = True    # BM25 sparse pre-filter before dense
    bm25_candidate_pool: int = 200         # Number of BM25 candidates to pre-filter
    two_stage_retrieval: bool = True       # BM25 rough → dense re-rank pipeline

    # ── Quantization / Model Preferences ──────────────────────────────────────
    prefer_quantized: bool = True          # Prefer quantized (q4/q8) Ollama models
    lightweight_model_priority: bool = True # Prioritize smaller models in fallback chain
    # Ordered preference list for Ollama model selection
    model_preference: list = field(default_factory=lambda: [
        "llama3.2:latest",
        "llama3.2",
        "llama3.2:3b",
        "llama3.2:1b",
        "phi3:mini",
        "gemma2:2b",
        "mistral:7b-q4_K_M",
        "llama3.1:latest",
        "llama3.1",
        "llama3",
        "mistral",
        "phi3",
        "qwen2.5",
    ])

    # ── RRF Parameters ────────────────────────────────────────────────────────
    rrf_k: int = 60  # Reciprocal Rank Fusion constant


# ── Preset Profiles ──────────────────────────────────────────────────────────

PROFILES = {
    "fast": {
        "profile": "fast",
        "cache_enabled": True,
        "cache_semantic_threshold": 0.88,
        "parallel_generation": True,
        "parallel_retrieval": True,
        "max_workers": 6,
        "adaptive_subquery_enabled": True,
        "min_subqueries": 2,
        "max_subqueries": 3,
        "dynamic_stopping_enabled": True,
        "stopping_similarity_threshold": 0.80,
        "faiss_enabled": True,
        "bm25_prefilter_enabled": True,
        "bm25_candidate_pool": 100,
        "two_stage_retrieval": True,
        "prefer_quantized": True,
        "lightweight_model_priority": True,
    },
    "balanced": {
        "profile": "balanced",
        "cache_enabled": True,
        "cache_semantic_threshold": 0.92,
        "parallel_generation": True,
        "parallel_retrieval": True,
        "max_workers": 4,
        "adaptive_subquery_enabled": True,
        "min_subqueries": 2,
        "max_subqueries": 5,
        "dynamic_stopping_enabled": True,
        "stopping_similarity_threshold": 0.85,
        "faiss_enabled": True,
        "bm25_prefilter_enabled": True,
        "bm25_candidate_pool": 200,
        "two_stage_retrieval": True,
        "prefer_quantized": True,
        "lightweight_model_priority": False,
    },
    "quality": {
        "profile": "quality",
        "cache_enabled": True,
        "cache_semantic_threshold": 0.96,
        "parallel_generation": True,
        "parallel_retrieval": True,
        "max_workers": 4,
        "adaptive_subquery_enabled": True,
        "min_subqueries": 3,
        "max_subqueries": 5,
        "dynamic_stopping_enabled": False,
        "stopping_similarity_threshold": 0.95,
        "faiss_enabled": True,
        "bm25_prefilter_enabled": True,
        "bm25_candidate_pool": 500,
        "two_stage_retrieval": True,
        "prefer_quantized": False,
        "lightweight_model_priority": False,
    },
}


# ── Singleton Config Instance ─────────────────────────────────────────────────

_active_config: Optional[MMLFOptimizerConfig] = None


def get_config() -> MMLFOptimizerConfig:
    """Return the active optimizer configuration (lazy-loaded singleton)."""
    global _active_config
    if _active_config is None:
        _active_config = _load_or_default()
    return _active_config


def set_profile(profile_name: str) -> MMLFOptimizerConfig:
    """Switch to a named profile and persist it."""
    global _active_config
    if profile_name not in PROFILES:
        raise ValueError(f"Unknown profile '{profile_name}'. Choose from: {list(PROFILES.keys())}")

    _active_config = MMLFOptimizerConfig(**PROFILES[profile_name])
    _persist(_active_config)
    logger.info(f"[Optimizer] Switched to '{profile_name}' profile.")
    return _active_config


def update_config(**kwargs) -> MMLFOptimizerConfig:
    """Update individual config parameters and persist."""
    global _active_config
    cfg = get_config()
    for key, value in kwargs.items():
        if hasattr(cfg, key):
            setattr(cfg, key, value)
        else:
            logger.warning(f"[Optimizer] Unknown config key ignored: {key}")
    _persist(cfg)
    return cfg


def _load_or_default() -> MMLFOptimizerConfig:
    """Load config from disk or create a default 'balanced' profile."""
    if os.path.exists(_CONFIG_PATH):
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            cfg = MMLFOptimizerConfig(**{k: v for k, v in data.items() if hasattr(MMLFOptimizerConfig, k)})
            logger.info(f"[Optimizer] Loaded config profile='{cfg.profile}' from disk.")
            return cfg
        except Exception as e:
            logger.warning(f"[Optimizer] Failed to load config, using defaults: {e}")

    return MMLFOptimizerConfig()


def _persist(cfg: MMLFOptimizerConfig):
    """Save config to disk."""
    try:
        os.makedirs(_CONFIG_DIR, exist_ok=True)
        with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(asdict(cfg), f, indent=2)
    except Exception as e:
        logger.warning(f"[Optimizer] Failed to persist config: {e}")


def get_config_dict() -> dict:
    """Return current config as a serializable dictionary."""
    return asdict(get_config())
