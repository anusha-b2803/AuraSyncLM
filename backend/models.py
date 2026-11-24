import os
import logging

# Prevent online hangs by prioritizing local cached weights
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_NO_TENSORFLOW"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# Silence verbose loggers early
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("ollama").setLevel(logging.WARNING)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

_model = None
_kw_model = None

def get_models():
    """Shared lazy loader for AI models loading instantly from local disk cache."""
    global _model, _kw_model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print("[AI Engine] Loading local embedding model (SentenceTransformer)...")
        # Try local MiniLM first (tested, 0.2s load time)
        try:
            _model = SentenceTransformer('all-MiniLM-L6-v2', local_files_only=True)
            print("[AI Engine] Successfully loaded 'all-MiniLM-L6-v2' from local cache.")
        except Exception:
            try:
                _model = SentenceTransformer('all-MiniLM-L6-v2')
            except Exception:
                try:
                    _model = SentenceTransformer('BAAI/bge-base-en-v1.5', local_files_only=True)
                except Exception as e:
                    print(f"[AI Engine] Local embedding model load fallback: {e}")
                    _model = None

        try:
            from keybert import KeyBERT
            _kw_model = KeyBERT(model=_model) if _model else None
        except Exception:
            _kw_model = None

    return _model, _kw_model
