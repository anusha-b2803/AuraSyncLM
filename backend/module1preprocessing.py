import re
import logging

logger = logging.getLogger(__name__)

# =========================
# CLEANING
# =========================
def clean_text(text):
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# =========================
# PREPROCESS
# =========================
def preprocess_text(raw_text):
    # No spam logging — called per file
    cleaned = clean_text(raw_text)

    # Simple whitespace-based tokenization (no NLTK needed for our use case)
    common_stopwords = {
        'the','a','an','is','in','it','of','to','and','or','for','on',
        'at','by','with','from','as','be','was','are','were','has','have',
        'had','not','but','this','that','these','those','its','their',
        'they','we','you','he','she','i','my','our','your','his','her',
        'do','did','does','so','if','no','up','out','use','can','will',
        'just','about','which','when','who','how','all','also','more',
        'than','then','into','been','would','could','should','may','each',
    }

    tokens = [w for w in cleaned.split() if w not in common_stopwords and len(w) > 2]
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if s.strip()]

    return {
        "cleaned_text": cleaned,
        "sentences": sentences,
        "tokens": tokens
    }