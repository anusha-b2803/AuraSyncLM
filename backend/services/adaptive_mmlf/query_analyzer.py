"""
Query Analyzer: Stage 1 of Adaptive MMLF Pipeline
Evaluates query complexity, detects ambiguity and technical domain,
and dynamically determines sub-query count and execution mode (fast vs smart).
"""

import re
from typing import Dict, Any, List, Optional


TECHNICAL_KEYWORDS = {
    # ML / AI / NLP
    "transformer", "rnn", "lstm", "nlp", "llm", "neural", "deep learning", 
    "machine learning", "bert", "gpt", "attention", "embedding", "vector",
    "quantization", "fine-tuning", "backpropagation", "cnn", "diffusion",
    "gradient", "hyperparameter", "overfitting", "latent", "loss function",
    "rag", "retrieval", "rerank", "fusion", "cross-encoder",
    # Computer Science & Systems
    "algorithm", "database", "sql", "nosql", "postgres", "redis", "mongodb",
    "distributed", "concurrency", "async", "threading", "latency", "throughput",
    "compiler", "operating system", "kernel", "memory", "cache", "microservice",
    "kubernetes", "docker", "api", "rest", "graphql", "websocket", "protocol",
    "encryption", "cryptography", "binary", "data structure", "tree", "graph"
}

AMBIGUOUS_PATTERNS = [
    r"\bvs\b",
    r"\bversus\b",
    r"\bcompare\b",
    r"\bcomparison\b",
    r"\bdifference\b",
    r"\bor\b",
    r"\bbest\b",
    r"\btop\b",
    r"\bwhich\s+is\s+better\b",
    r"\bpros\s+and\s+cons\b"
]


class QueryAnalyzer:
    """
    Analyzes user queries to compute complexity scores, sub-query counts,
    and adaptive routing decisions (Fast ⚡ vs Smart 🧠).
    """

    def __init__(self):
        self.technical_keywords = TECHNICAL_KEYWORDS
        self.ambiguous_regexes = [re.compile(p, re.IGNORECASE) for p in AMBIGUOUS_PATTERNS]

    def compute_complexity(self, query: str) -> float:
        """
        Computes a normalized complexity score between 0.0 and 1.0.
        - Empty query -> 0.0
        - Query >= 500 characters -> 1.0
        - Single-word query -> < 0.2 (e.g. 'Python' -> ~0.10)
        - Multi-word query -> 0.3 - 0.6 (e.g. 'How does machine learning work?' -> ~0.45-0.55)
        - Complex multi-concept query -> > 0.8 (e.g. 'Compare transformer vs RNN for NLP...')
        """
        if not query or not query.strip():
            return 0.0

        cleaned = query.strip()
        length = len(cleaned)

        # Explicit test requirement: 500+ char query -> complexity 1.0
        if length >= 500:
            return 1.0

        words = re.findall(r"\w+", cleaned)
        word_count = len(words)

        if word_count == 0:
            return 0.0

        # Special case: single word query must score below 0.2 (Test requirement: "Python" -> < 0.2)
        if word_count == 1:
            return min(0.15, max(0.05, length / 100.0))

        # Detect technical keywords
        query_lower = cleaned.lower()
        detected_tech = self.detect_technical_keywords(query_lower)
        tech_score = min(0.40, len(detected_tech) * 0.12)

        # Detect ambiguity / comparison patterns
        is_ambiguous = self.detect_ambiguity(query_lower)
        ambiguity_bonus = 0.15 if is_ambiguous else 0.0

        # Length / word score
        # Base for 2-4 words: ~0.25 - 0.35
        # Base for 5-8 words: ~0.35 - 0.45
        # Base for 9+ words: ~0.45 - 0.60
        if word_count <= 4:
            base_word_score = 0.20 + (word_count - 2) * 0.05
        elif word_count <= 8:
            base_word_score = 0.30 + (word_count - 4) * 0.03
        else:
            base_word_score = 0.42 + min(0.18, (word_count - 8) * 0.02)

        # Question / clause complexity bonus
        question_bonus = 0.05 if "?" in cleaned or any(w in query_lower for w in ["how", "why", "explain", "what"]) else 0.0

        raw_score = base_word_score + tech_score + ambiguity_bonus + question_bonus

        # Specific calibration for expected test cases:
        # 1. "How does machine learning work?" (5 words, 1 tech term "machine learning") -> target > 0.4 and <= 0.6
        # 2. "Compare transformer vs RNN for NLP in low resource settings" -> target > 0.8
        score = max(0.0, min(1.0, round(raw_score, 3)))

        return score

    def detect_technical_keywords(self, query_lower: str) -> List[str]:
        """Detects presence of technical domain keywords."""
        found = []
        for kw in self.technical_keywords:
            if " " in kw:
                if kw in query_lower:
                    found.append(kw)
            else:
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, query_lower):
                    found.append(kw)
        return found

    def detect_ambiguity(self, query_lower: str) -> bool:
        """Detects if query contains comparison, alternative or subjective ranking patterns."""
        for regex in self.ambiguous_regexes:
            if regex.search(query_lower):
                return True
        return False

    def decide_subquery_count(self, complexity: float) -> int:
        """
        Maps complexity score to sub-query count:
        - Complexity < 0.2    -> 1 sub-query
        - Complexity 0.2-0.4  -> 2 sub-queries
        - Complexity 0.4-0.6  -> 3 sub-queries
        - Complexity 0.6-0.8  -> 4 sub-queries
        - Complexity > 0.8    -> 5 sub-queries
        Count never goes below 1 and never exceeds 5.
        """
        if complexity < 0.2:
            count = 1
        elif complexity < 0.4:
            count = 2
        elif complexity <= 0.6:
            count = 3
        elif complexity <= 0.8:
            count = 4
        else:
            count = 5

        return max(1, min(5, count))

    def decide_mode(self, complexity: float, force_mode: Optional[str] = None) -> str:
        """
        Decides execution mode:
        - Low complexity (< 0.3) -> 'fast'
        - High complexity (>= 0.3) -> 'smart'
        - Overridden if force_mode is 'fast' or 'smart'
        """
        if force_mode in ("fast", "smart"):
            return force_mode

        return "fast" if complexity < 0.3 else "smart"

    def analyze(self, query: str, force_mode: Optional[str] = None) -> Dict[str, Any]:
        """
        Complete Stage 1 analysis returning complexity, count, mode, and detected patterns.
        """
        cleaned = (query or "").strip()
        query_lower = cleaned.lower()

        complexity = self.compute_complexity(cleaned)
        subquery_count = self.decide_subquery_count(complexity)
        is_ambiguous = self.detect_ambiguity(query_lower) if cleaned else False
        tech_terms = self.detect_technical_keywords(query_lower) if cleaned else []
        suggested_mode = "fast" if complexity < 0.3 else "smart"
        active_mode = self.decide_mode(complexity, force_mode)

        return {
            "query": cleaned,
            "complexity": complexity,
            "subquery_count": subquery_count,
            "suggested_mode": suggested_mode,
            "mode": active_mode,
            "is_ambiguous": is_ambiguous,
            "technical_terms": tech_terms,
            "is_technical": len(tech_terms) > 0
        }
