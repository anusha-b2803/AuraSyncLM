"""
MMLF Quantization & Lightweight Model Utilities
=================================================
Handles model selection preferences for reduced-resource MMLF inference:
  - Auto-detect quantized Ollama models (q4_K_M, q8_0, etc.)
  - Intelligent model selection based on available hardware
  - Preference for smaller models in constrained environments
"""

import logging
from typing import Optional, Tuple, List

logger = logging.getLogger(__name__)


# ── Quantization-aware tags ───────────────────────────────────────────────────
# Tags that indicate quantized / lightweight model variants in Ollama
QUANTIZED_TAGS = ["q4_k_m", "q4_0", "q4_k_s", "q5_k_m", "q8_0", "q5_0", "fp16"]
LIGHTWEIGHT_INDICATORS = ["1b", "2b", "3b", "mini", "small", "tiny", "nano"]


def is_quantized(model_name: str) -> bool:
    """Check if a model name indicates quantization."""
    name_lower = model_name.lower()
    return any(tag in name_lower for tag in QUANTIZED_TAGS)


def is_lightweight(model_name: str) -> bool:
    """Check if a model name indicates a lightweight / small variant."""
    name_lower = model_name.lower()
    return any(ind in name_lower for ind in LIGHTWEIGHT_INDICATORS)


def estimate_model_size_tier(model_name: str) -> str:
    """
    Categorize model into size tiers for prioritization.
    Returns: 'tiny' | 'small' | 'medium' | 'large'
    """
    name = model_name.lower()
    if any(t in name for t in ["1b", "nano", "tiny"]):
        return "tiny"
    if any(t in name for t in ["2b", "3b", "mini", "small"]):
        return "small"
    if any(t in name for t in ["7b", "8b"]):
        return "medium"
    return "large"


def select_optimal_model(
    available_models: List[str],
    prefer_quantized: bool = True,
    prefer_lightweight: bool = False,
    preference_list: Optional[List[str]] = None
) -> Optional[str]:
    """
    Select the optimal model from available Ollama models based on preferences.
    
    Priority order:
      1. Models matching preference_list (in order)
      2. Quantized variants if prefer_quantized
      3. Lightweight variants if prefer_lightweight
      4. Any available model as fallback
      
    Args:
        available_models: List of model names from Ollama
        prefer_quantized: Prioritize quantized models for speed
        prefer_lightweight: Prioritize smaller models
        preference_list: Ordered list of preferred model name patterns
        
    Returns:
        Best model name or None
    """
    if not available_models:
        return None

    # Strategy 1: Match against preference list
    if preference_list:
        for candidate in preference_list:
            for model in available_models:
                if candidate.lower() in model.lower():
                    logger.info(f"[Quantization] Selected preferred model: {model}")
                    return model

    # Strategy 2: Score-based selection
    def score_model(m: str) -> float:
        s = 0.0
        if prefer_quantized and is_quantized(m):
            s += 10.0
        if prefer_lightweight and is_lightweight(m):
            s += 8.0

        tier = estimate_model_size_tier(m)
        if prefer_lightweight:
            tier_scores = {"tiny": 6.0, "small": 4.0, "medium": 2.0, "large": 0.0}
        else:
            tier_scores = {"tiny": 0.0, "small": 2.0, "medium": 4.0, "large": 3.0}
        s += tier_scores.get(tier, 0.0)

        # Bonus for known-capable model families
        name = m.lower()
        if "llama" in name:
            s += 1.5
        if "phi" in name:
            s += 1.0
        if "mistral" in name:
            s += 1.0
        if "gemma" in name:
            s += 0.8
        if "qwen" in name:
            s += 0.5

        return s

    scored = [(score_model(m), m) for m in available_models]
    scored.sort(key=lambda x: x[0], reverse=True)

    best = scored[0][1]
    logger.info(f"[Quantization] Score-selected model: {best} (score={scored[0][0]:.1f})")
    return best


def get_optimized_ollama_client_and_model() -> Tuple[Optional[object], str]:
    """
    Enhanced version of get_ollama_client_and_model() that respects
    quantization and lightweight preferences from optimizer config.
    """
    try:
        from mmlf_optimizer_config import get_config
        cfg = get_config()
    except ImportError:
        cfg = None

    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')
        models_resp = client.list()

        models = []
        if hasattr(models_resp, 'models'):
            models = [m.model for m in models_resp.models]
        elif isinstance(models_resp, dict):
            models = [m.get('name') for m in models_resp.get('models', [])]

        if not models:
            return client, 'llama3.1'

        if cfg:
            best = select_optimal_model(
                available_models=models,
                prefer_quantized=cfg.prefer_quantized,
                prefer_lightweight=cfg.lightweight_model_priority,
                preference_list=cfg.model_preference,
            )
            if best:
                return client, best

        # Fallback to first available
        return client, models[0]

    except Exception as e:
        logger.warning(f"[Quantization] Ollama discovery fallback: {e}")
        return None, 'llama3.1'


def get_model_info(model_name: str) -> dict:
    """Return metadata about a model for optimization decisions."""
    return {
        "name": model_name,
        "quantized": is_quantized(model_name),
        "lightweight": is_lightweight(model_name),
        "size_tier": estimate_model_size_tier(model_name),
    }
