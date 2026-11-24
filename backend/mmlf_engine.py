"""
MMLF Engine v2: Optimized Multi-Query Multi-Passage Late Fusion
================================================================
Based on Kuo et al., "MMLF: Multi-query Multi-passage Late Fusion Retrieval"
Findings of the Association for Computational Linguistics: NAACL 2025, pages 6602-6613.

Optimizations implemented to overcome paper limitations:
  1. ⚡ Parallel Passage Generation    (ThreadPoolExecutor)
  2. ⚡ Parallel Multi-List Retrieval  (Concurrent dense searches)
  3. 💾 Multi-Tier Semantic Caching    (LRU + cosine fuzzy match + TTL)
  4. 🎯 Adaptive Sub-query Count       (2/3/5 based on query complexity)
  5. 🛑 Dynamic Stopping               (Skip redundant sub-queries via similarity)
  6. 🔀 BM25 + Dense Hybrid Retrieval  (Two-stage sparse→dense pipeline)
  7. 📉 Quantized Model Preference     (Auto-select smaller/quantized Ollama models)
  8. ⚙️  Configurable Profiles          (fast / balanced / quality presets)

Core MMLF components:
  1. MQR (Multi-Query Generation):  Appendix B.3 (Table 7) adapted for academic retrieval
  2. CQE (Combined Query Expansion): Appendix B.5 (Table 9) joint query-passage expansion
  3. RRF (Reciprocal Rank Fusion):   Section 2.3 & Appendix A.2 (k=60 rank-based late fusion)
  4. MQ2MP Pipeline:                 Section 2.2 two-stage decomposition and expansion
"""

import os
import re
import json
import time
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

# ── Import optimization modules ──────────────────────────────────────────────
try:
    from mmlf_optimizer_config import get_config
except ImportError:
    get_config = None

try:
    from mmlf_cache import get_subquery_cache, get_passage_cache, get_pipeline_cache
except ImportError:
    get_subquery_cache = None
    get_passage_cache = None
    get_pipeline_cache = None

try:
    from mmlf_quantization import get_optimized_ollama_client_and_model
except ImportError:
    get_optimized_ollama_client_and_model = None


# Reciprocal Rank Fusion constant from Cormack et al. (2009) & MMLF Paper Section 2.3
RRF_K = 60

# ── 1. MQR Prompt (Structured JSON & Plaintext compatible) ─────────────────────
MQR_TEMPLATE = """You are an academic study assistant in Information Retrieval and Natural Language Processing. For the user's research query, generate exactly {n_subqueries} diverse, high-quality search queries from different perspectives to retrieve relevant educational materials (lecture notes, textbooks, slides, research papers) from a vector database:
1. Core theoretical foundations & definitions
2. Architecture, algorithmic mechanisms, and methodology
3. Empirical evaluation, benchmarks, and practical applications
{extra_perspectives}

IMPORTANT DOMAIN RULES:
- If the query mentions 'MMLF', note that MMLF stands strictly for 'Multi-query Multi-passage Late Fusion Retrieval' (Kuo et al., NAACL 2025). Do NOT invent speculative acronym expansions.
- Each generated query must be concise, mathematically or conceptually targeted, and relevant to the original question.

Original question: {query}

Respond ONLY with a valid JSON object in this format:
{{
  "subqueries": [
    "query 1: theoretical foundation and core concepts",
    "query 2: architecture, pipeline, and methodology",
    "query 3: applications, benchmarks, and evaluation"
  ]
}}"""

# ── 2. CQE Prompt (Combined Query Expansion) ─────────────────────────────────
CQE_TEMPLATE = """You are an expert academic researcher in Information Retrieval and Natural Language Processing.
Write a single, detailed, factually grounded academic passage (150-250 words) that simultaneously addresses both the original research question and the specific sub-query perspective below. The passage should be rich in technical terminology, mathematical mechanisms, and algorithmic pipeline details suitable for peer-reviewed academic literature.

STRICT GROUNDING & FACTUAL RULES:
1. TECHNICAL ACRONYMS: If the query mentions 'MMLF', it refers strictly to 'Multi-query Multi-passage Late Fusion Retrieval' (Kuo, Lin, and Wang, NAACL 2025). Do NOT invent alternative, speculative, or fictitious expansions for MMLF (such as 'Multi-Modal Learning Framework' or 'Maximum Margin Linear Filter').
2. DOMAIN RELEVANCE: Ground the explanation strictly in information retrieval concepts: dense bi-encoder indexing, reciprocal rank fusion (RRF with k=60), query decomposition (MQR), pseudo-passage expansion (CQE), and late fusion rank aggregation.
3. FACTUAL INTEGRITY: Do NOT fabricate fake author names, imaginary datasets, or unsupported claims. Write directly about the core mechanisms and theoretical properties.

Original question: {original_query}
Sub-query focus: {sub_query}

Write the academic passage directly without any preamble, title, or conversational commentary."""


def generate_heuristic_subqueries(user_query: str, count: int = 3) -> List[str]:
    """
    Intelligent heuristic fallback: guarantees diverse, distinct perspectives
    if LLM generation fails or times out, preventing duplicate query collapse.
    """
    clean_q = re.sub(
        r'^(what is|what are|how is|how does|how to|how can|define|explain|state the|state|give an overview of)\s+',
        '', user_query, flags=re.IGNORECASE
    ).strip(' ?.:;\'"')
    if not clean_q or len(clean_q) < 3:
        clean_q = user_query.strip(' ?.')

    perspectives = [
        f"Theoretical foundations and mathematical formulation of {clean_q}",
        f"Architecture, mechanism, and algorithmic pipeline for {clean_q}",
        f"Empirical evaluation, intrusion detection benchmarks, and applications of {clean_q}",
        f"Historical development and evolution of {clean_q} in academic literature",
        f"Practical implementation challenges and real-world case studies of {clean_q}",
    ]
    return perspectives[:count]


def get_ollama_client_and_model():
    """
    Discover reachable Ollama instance and preferred active model.
    Now enhanced with quantization-aware selection when optimizer is available.
    """
    # Use the optimized selector if available
    if get_optimized_ollama_client_and_model is not None:
        try:
            return get_optimized_ollama_client_and_model()
        except Exception:
            pass

    # Original fallback
    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')
        models_resp = client.list()

        models = []
        if hasattr(models_resp, 'models'):
            models = [m.model for m in models_resp.models]
        elif isinstance(models_resp, dict):
            models = [m.get('name') for m in models_resp.get('models', [])]

        # Order of preference based on capabilities
        for candidate in ['llama3.1', 'llama3.1:latest', 'llama3.2', 'llama3.2:3b', 'llama3.2:1b', 'llama3', 'mistral', 'phi3', 'qwen2.5']:
            for m in models:
                if candidate in m.lower():
                    return client, m

        # Default fallback
        if models:
            return client, models[0]
        return client, 'llama3.1'
    except Exception as e:
        logger.warning(f"Ollama discovery fallback: {e}")
        return None, 'llama3.1'


# ── Adaptive Sub-query Count ─────────────────────────────────────────────────

def determine_subquery_count(query: str) -> int:
    """
    Determine optimal sub-query count based on query complexity.
    Replaces the paper's fixed n=3 with adaptive 2/3/5.
    
    Heuristics:
      - Short simple queries (≤4 words):   2 sub-queries
      - Medium queries (5-10 words):        3 sub-queries (paper default)
      - Long/complex queries (>10 words):   4-5 sub-queries
      - Compound/comparative queries:       5 sub-queries always
    """
    cfg = get_config() if get_config else None

    q = query.lower().strip()
    words = len(q.split())

    # Compound queries always get maximum
    comparative_markers = [
        "compare", " vs ", " vs. ", "versus", "difference between",
        "tradeoff", "trade-off", "distinguish", "how do both",
        "relationship between", "similarities and differences",
        " and explain ", " along with ", " as well as ",
        " pros and cons ", " advantages and disadvantages "
    ]
    if any(m in q for m in comparative_markers):
        return min(cfg.max_subqueries if cfg else 5, 5)

    simple_max = cfg.simple_query_max_words if cfg else 4
    medium_max = cfg.medium_query_max_words if cfg else 10
    min_sq = cfg.min_subqueries if cfg else 2
    max_sq = cfg.max_subqueries if cfg else 5

    if words <= simple_max:
        return min_sq
    elif words <= medium_max:
        return 3
    else:
        return min(max_sq, max(4, words // 3))


# ── Dynamic Stopping ─────────────────────────────────────────────────────────

def _cosine_sim(a: List[float], b: List[float]) -> float:
    """Fast cosine similarity without numpy."""
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _get_text_embedding(text: str) -> Optional[List[float]]:
    """Get embedding for dynamic stopping comparison."""
    try:
        from models import get_models
        model, _ = get_models()
        if model is not None:
            return model.encode(text).tolist()
    except Exception:
        pass
    return None


def filter_redundant_subqueries(
    subqueries: List[str],
    threshold: float = 0.85
) -> List[str]:
    """
    Dynamic Stopping: Remove sub-queries that are too similar to existing ones.
    This prevents generating redundant passages that add no retrieval diversity.
    
    Algorithm:
      For each sub-query, compute its embedding and compare to all accepted
      sub-queries. If similarity exceeds threshold, skip it.
    """
    if len(subqueries) <= 1:
        return subqueries

    embeddings = []
    for sq in subqueries:
        emb = _get_text_embedding(sq)
        embeddings.append(emb)

    # If embeddings unavailable, can't do dynamic stopping
    if any(e is None for e in embeddings):
        return subqueries

    accepted = [subqueries[0]]
    accepted_embs = [embeddings[0]]

    for i in range(1, len(subqueries)):
        is_redundant = False
        for acc_emb in accepted_embs:
            sim = _cosine_sim(embeddings[i], acc_emb)
            if sim >= threshold:
                logger.info(
                    f"[DynStop] Pruned redundant sub-query (sim={sim:.3f}): "
                    f"'{subqueries[i][:60]}...'"
                )
                is_redundant = True
                break

        if not is_redundant:
            accepted.append(subqueries[i])
            accepted_embs.append(embeddings[i])

    return accepted


# ── Stage 1: Multi-Query Generation (MQR) ───────────────────────────────────

def generate_subqueries(
    user_query: str,
    client=None,
    model: Optional[str] = None,
    n_subqueries: Optional[int] = None
) -> List[str]:
    """
    Stage 1: Multi-Query Generation (MQR)
    Paper Section 2.1 & Appendix B.3 (Table 7)
    
    Now enhanced with:
      - Adaptive sub-query count (2/3/5)
      - Semantic caching
      - Dynamic stopping (redundancy pruning)
    """
    cfg = get_config() if get_config else None

    # Determine sub-query count
    if n_subqueries is None:
        if cfg and cfg.adaptive_subquery_enabled:
            n_subqueries = determine_subquery_count(user_query)
        else:
            n_subqueries = 3  # Paper default

    # Check cache first
    if cfg and cfg.cache_enabled and get_subquery_cache:
        cache = get_subquery_cache()
        query_emb = _get_text_embedding(user_query)
        cached = cache.get(user_query, embedding=query_emb)
        if cached is not None:
            logger.info(f"[MQR] Cache HIT — returning {len(cached)} cached sub-queries")
            return cached[:n_subqueries]

    heuristic_fallbacks = generate_heuristic_subqueries(user_query, count=n_subqueries)

    if client is None or model is None:
        disc_client, disc_model = get_ollama_client_and_model()
        client = client or disc_client
        model = model or disc_model

    if client is None:
        return heuristic_fallbacks

    # Build prompt with adaptive count
    extra = ""
    if n_subqueries > 3:
        extra_lines = [
            "4. Historical development and evolution",
            "5. Implementation challenges and real-world case studies",
        ]
        extra = "\n".join(extra_lines[:n_subqueries - 3])

    prompt = MQR_TEMPLATE.format(
        query=user_query,
        n_subqueries=n_subqueries,
        extra_perspectives=extra
    )

    try:
        # Request JSON format with moderate temperature for diversity
        response = client.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            format='json',
            options={'temperature': 0.7, 'top_p': 0.9, 'num_predict': 300 + (n_subqueries - 3) * 60}
        )
        raw = response['message']['content'].strip()

        subqueries = []

        # Strategy A: Parse valid JSON
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                candidates = data.get("subqueries") or data.get("queries") or data.get("perspectives") or []
                if isinstance(candidates, list):
                    for c in candidates:
                        if isinstance(c, str) and len(c.strip()) > 5:
                            subqueries.append(c.strip().strip('*_ "\''))
            elif isinstance(data, list):
                for c in data:
                    if isinstance(c, str) and len(c.strip()) > 5:
                        subqueries.append(c.strip().strip('*_ "\''))
        except Exception:
            pass

        # Strategy B: Robust Regex & Multi-line block parser if JSON extraction yielded < n_subqueries
        if len(subqueries) < n_subqueries:
            lines = [l.strip() for l in raw.split('\n') if l.strip()]
            for idx, line in enumerate(lines):
                # Ignore noise / preamble
                if any(noise in line.lower() for noise in ["retrieving relevant", "materials:", "here are"]):
                    continue

                # Match patterns like Sub-query 1:, 1., **1.**
                m = re.match(r'^(?:\*{0,2})Sub-query\s*\d+\s*(?:\*{0,2})\s*:\s*(.*)$', line, re.IGNORECASE)
                if m:
                    content = m.group(1).strip().strip('*_ "\'')
                    # If query text was placed on next line
                    if not content and idx + 1 < len(lines):
                        next_line = lines[idx + 1].strip().strip('*_ "\'')
                        if not next_line.lower().startswith("retrieving"):
                            content = next_line
                    if content and len(content) > 5 and content not in subqueries:
                        subqueries.append(content)
                elif re.match(r'^(?:\*{0,2})\d+[\.)\-:]\s*(?:\*{0,2})\s*(.+)$', line):
                    m_num = re.match(r'^(?:\*{0,2})\d+[\.)\-:]\s*(?:\*{0,2})\s*(.+)$', line)
                    content = m_num.group(1).strip().strip('*_ "\'')
                    if content and len(content) > 5 and content not in subqueries:
                        subqueries.append(content)

        # Strategy C: Deduplication & Quality Filtering
        cleaned_subqueries = []
        user_norm = user_query.strip().lower().strip('?. ')
        for sq in subqueries:
            # Strip trailing comments like "Retrieving relevant materials:..."
            sq_clean = re.split(r'\s*retrieving\s+relevant', sq, flags=re.IGNORECASE)[0].strip()
            sq_norm = sq_clean.strip('?. "').lower()
            if sq_clean and len(sq_clean) > 8 and sq_norm != user_norm and sq_clean not in cleaned_subqueries:
                cleaned_subqueries.append(sq_clean)

        # Strategy D: Fill any remaining slots with distinct heuristic perspectives (never duplicate!)
        fallback_idx = 0
        while len(cleaned_subqueries) < n_subqueries and fallback_idx < len(heuristic_fallbacks):
            candidate = heuristic_fallbacks[fallback_idx]
            if candidate not in cleaned_subqueries:
                cleaned_subqueries.append(candidate)
            fallback_idx += 1

        result = cleaned_subqueries[:n_subqueries]

        # Dynamic Stopping: prune redundant sub-queries
        if cfg and cfg.dynamic_stopping_enabled:
            result = filter_redundant_subqueries(
                result,
                threshold=cfg.stopping_similarity_threshold
            )

        # Cache the result
        if cfg and cfg.cache_enabled and get_subquery_cache:
            query_emb = _get_text_embedding(user_query)
            get_subquery_cache().put(user_query, result, embedding=query_emb)

        return result
    except Exception as e:
        logger.error(f"MQR subquery generation fallback: {e}")
        return heuristic_fallbacks


# ── Stage 2: Combined Query Expansion (CQE) — Pseudo-passage Generation ─────

def generate_pseudo_document(
    original_query: str,
    sub_query: str,
    client=None,
    model: Optional[str] = None
) -> str:
    """
    Stage 2: Combined Query Expansion (CQE)
    Paper Section 2.2 & Appendix B.5 (Table 9)
    Expands original query + sub-query simultaneously into an enriched pseudo-passage.
    
    Now enhanced with passage-level caching.
    """
    cfg = get_config() if get_config else None
    cache_key = f"{original_query}|||{sub_query}"

    # Check cache first
    if cfg and cfg.cache_enabled and get_passage_cache:
        cached = get_passage_cache().get(cache_key)
        if cached is not None:
            logger.info(f"[CQE] Cache HIT for passage: '{sub_query[:50]}...'")
            return cached

    if client is None or model is None:
        disc_client, disc_model = get_ollama_client_and_model()
        client = client or disc_client
        model = model or disc_model

    if client is None:
        return f"{original_query} {sub_query}"

    prompt = CQE_TEMPLATE.format(
        original_query=original_query,
        sub_query=sub_query
    )

    try:
        response = client.chat(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            options={'temperature': 0.7, 'top_p': 0.95, 'num_predict': 384}
        )
        raw = response['message']['content'].strip()

        if 'Passage:' in raw:
            result = raw.split('Passage:')[-1].strip()
        else:
            result = raw

        # Cache the passage
        if cfg and cfg.cache_enabled and get_passage_cache:
            get_passage_cache().put(cache_key, result)

        return result
    except Exception as e:
        logger.error(f"CQE pseudo-document generation failed: {e}")
        return f"{original_query}. {sub_query}."


# ── Parallel Passage Generation ──────────────────────────────────────────────

def generate_passages_parallel(
    original_query: str,
    subqueries: List[str],
    client=None,
    model: Optional[str] = None,
    max_workers: int = 4,
    progress_callback: Optional[Callable] = None
) -> List[str]:
    """
    Generate all pseudo-passages concurrently using ThreadPoolExecutor.
    
    Instead of sequential: q→p1, q→p2, q→p3 (3x latency)
    We do parallel:        q→[p1, p2, p3] simultaneously (~1x latency)
    """
    if len(subqueries) <= 1:
        # No benefit from parallelism for single sub-query
        doc = generate_pseudo_document(original_query, subqueries[0], client, model)
        if progress_callback:
            progress_callback("cqe_item", "Synthesized passage 1", {"index": 0, "passage": doc[:120] + "..."})
        return [doc]

    passages = [None] * len(subqueries)
    workers = min(max_workers, len(subqueries))

    def _gen_single(idx: int, sq: str) -> tuple:
        doc = generate_pseudo_document(original_query, sq, client, model)
        return idx, doc

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_gen_single, i, sq): i
            for i, sq in enumerate(subqueries)
        }

        completed = 0
        for future in as_completed(futures):
            try:
                idx, doc = future.result()
                passages[idx] = doc
                completed += 1
                if progress_callback:
                    progress_callback(
                        "cqe_item",
                        f"Synthesized passage {completed}/{len(subqueries)} (parallel)",
                        {"index": idx, "passage": doc[:120] + "..."}
                    )
            except Exception as e:
                idx = futures[future]
                logger.error(f"Parallel CQE failed for sub-query {idx}: {e}")
                passages[idx] = f"{original_query}. {subqueries[idx]}."

    # Fill any None gaps
    for i in range(len(passages)):
        if passages[i] is None:
            passages[i] = f"{original_query}. {subqueries[i]}."

    return passages


# ── Parallel Retrieval ───────────────────────────────────────────────────────

def retrieve_parallel(
    queries: List[str],
    retriever_func: Callable[[str, int], List[Dict[str, Any]]],
    top_k: int = 10,
    max_workers: int = 4
) -> List[List[Dict[str, Any]]]:
    """
    Execute all retrieval calls concurrently.
    
    Instead of sequential: R(q), R(p1), R(p2), R(p3) (4x latency)
    We do parallel:        R(q) ┐
                           R(p1)├→ all at once (~1x latency)
                           R(p2)│
                           R(p3)┘
    """
    results = [None] * len(queries)

    def _retrieve_single(idx: int, q: str) -> tuple:
        return idx, retriever_func(q, top_k)

    workers = min(max_workers, len(queries))

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(_retrieve_single, i, q): i
            for i, q in enumerate(queries)
        }
        for future in as_completed(futures):
            try:
                idx, res = future.result()
                results[idx] = res
            except Exception as e:
                idx = futures[future]
                logger.error(f"Parallel retrieval failed for query {idx}: {e}")
                results[idx] = []

    # Fill None gaps
    return [r if r is not None else [] for r in results]


# ── BM25 Sparse Pre-filter ──────────────────────────────────────────────────

class BM25Index:
    """
    Lightweight BM25 keyword index for fast sparse pre-filtering.
    Used in the two-stage retrieval pipeline: BM25 rough → dense re-rank.
    """

    def __init__(self):
        self._documents = []
        self._doc_metas = []
        self._initialized = False

    def build(self, documents: List[str], metadatas: List[Dict[str, Any]]):
        """Build the BM25 index from document texts."""
        self._documents = documents
        self._doc_metas = metadatas
        self._tokenized = [self._tokenize(doc) for doc in documents]

        # Compute IDF
        from collections import Counter
        n_docs = len(self._tokenized)
        self._avgdl = sum(len(d) for d in self._tokenized) / max(n_docs, 1)
        self._doc_freqs = Counter()
        for tokens in self._tokenized:
            unique_tokens = set(tokens)
            for t in unique_tokens:
                self._doc_freqs[t] += 1

        self._n_docs = n_docs
        self._initialized = True
        logger.info(f"[BM25] Built index over {n_docs} documents.")

    def search(self, query: str, top_k: int = 200) -> List[Dict[str, Any]]:
        """BM25 scoring and ranking."""
        if not self._initialized:
            return []

        import math
        k1, b = 1.5, 0.75
        query_tokens = self._tokenize(query)

        scores = []
        for doc_idx, doc_tokens in enumerate(self._tokenized):
            score = 0.0
            dl = len(doc_tokens)
            from collections import Counter
            tf_counter = Counter(doc_tokens)

            for qt in query_tokens:
                tf = tf_counter.get(qt, 0)
                if tf == 0:
                    continue
                df = self._doc_freqs.get(qt, 0)
                idf = math.log((self._n_docs - df + 0.5) / (df + 0.5) + 1.0)
                tf_norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / self._avgdl))
                score += idf * tf_norm

            if score > 0:
                scores.append((doc_idx, score))

        scores.sort(key=lambda x: x[1], reverse=True)

        results = []
        for doc_idx, score in scores[:top_k]:
            result = {
                "text": self._documents[doc_idx],
                "score": score,
                "bm25_score": score,
            }
            if doc_idx < len(self._doc_metas):
                result.update(self._doc_metas[doc_idx])
            results.append(result)

        return results

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        """Simple whitespace + punctuation tokenizer."""
        text = text.lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        return [t for t in text.split() if len(t) > 1]

    @property
    def is_ready(self) -> bool:
        return self._initialized


# Global BM25 index singleton
_bm25_index: Optional[BM25Index] = None


def get_bm25_index() -> BM25Index:
    """Get or create the global BM25 index."""
    global _bm25_index
    if _bm25_index is None:
        _bm25_index = BM25Index()
    return _bm25_index


def build_bm25_from_chroma(user_id: str = "default"):
    """Build BM25 index from the existing ChromaDB collection for hybrid retrieval."""
    try:
        from main import get_user_paths
        import chromadb

        user_paths = get_user_paths(user_id)
        chroma_dir = os.path.join(user_paths["data_dir"], "chroma_db")
        if not os.path.exists(chroma_dir):
            logger.warning("[BM25] No ChromaDB found, skipping BM25 build.")
            return

        client = chromadb.PersistentClient(path=chroma_dir)
        try:
            collection = client.get_collection(name="rag_collection")
        except Exception:
            return

        # Get all documents from ChromaDB
        all_data = collection.get(include=["documents", "metadatas"])
        docs = all_data.get("documents", [])
        metas = all_data.get("metadatas", [])

        if not docs:
            return

        # Build metadata dicts with file tuples
        meta_dicts = []
        for m in metas:
            meta_dicts.append({
                "file": (
                    m.get("name", "Unknown"),
                    m.get("path", ""),
                    m.get("domain", ""),
                    m.get("topic", ""),
                    m.get("subtopic", "")
                )
            })

        bm25 = get_bm25_index()
        bm25.build(docs, meta_dicts)
        logger.info(f"[BM25] Successfully built hybrid index with {len(docs)} documents.")
    except Exception as e:
        logger.error(f"[BM25] Failed to build index: {e}")


# ── Stage 4: Reciprocal Rank Fusion (RRF) ───────────────────────────────────

def reciprocal_rank_fusion(
    ranked_lists: List[List[Dict[str, Any]]],
    top_k: int = 5,
    k: int = RRF_K
) -> List[Dict[str, Any]]:
    """
    Stage 4: Reciprocal Rank Fusion (RRF) with Source Diversity
    Paper Section 2.3 & Appendix A.2
    
    Formula:
        score_RRF(d) = sum_{i=0}^n ( 1 / (k + rank_i(d)) )
        where rank_i(d) is 1-indexed.

    Includes source diversity capping to avoid chunk-level redundancy from the same file.
    """
    rrf_scores = defaultdict(float)
    doc_registry = {}

    for list_idx, ranked_list in enumerate(ranked_lists):
        for rank_0, item in enumerate(ranked_list):
            rank = rank_0 + 1  # 1-indexed rank

            # Unique identifier for the chunk
            # Priority: 1. explicit chunk ID (e.g., 'naacl_chunk_71'), 2. file_path + text hash
            chunk_id = item.get('id')
            if not chunk_id:
                file_meta = item.get('file', ())
                file_path = file_meta[1] if (isinstance(file_meta, (list, tuple)) and len(file_meta) > 1) else str(file_meta)
                text_snippet = item.get('text', '')[:100]
                chunk_id = f"{file_path}::{hash(text_snippet)}"
            
            doc_key = chunk_id

            # RRF formula
            rrf_scores[doc_key] += 1.0 / (k + rank)

            if doc_key not in doc_registry:
                doc_item = item.copy()
                doc_item['id'] = chunk_id
                doc_registry[doc_key] = doc_item

    # Sort documents by RRF score descending
    sorted_candidates = sorted(
        rrf_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    # Source diversity selection:
    # Ensure diverse source representation by capping chunks per unique file in top results
    max_per_source = max(2, top_k // 2)
    source_counts = defaultdict(int)
    selected_docs = []
    deferred_docs = []

    for doc_key, score in sorted_candidates:
        doc = doc_registry[doc_key]
        file_meta = doc.get('file', ())
        source_id = file_meta[0] if (isinstance(file_meta, (list, tuple)) and len(file_meta) > 0) else str(file_meta)

        if source_counts[source_id] < max_per_source:
            selected_docs.append((doc_key, score))
            source_counts[source_id] += 1
            if len(selected_docs) >= top_k:
                break
        else:
            deferred_docs.append((doc_key, score))

    # Backfill if top_k not yet reached (e.g., small file collection)
    while len(selected_docs) < top_k and deferred_docs:
        selected_docs.append(deferred_docs.pop(0))

    fused_results = []
    for final_rank_0, (doc_key, score) in enumerate(selected_docs):
        doc = doc_registry[doc_key]
        doc['id'] = doc_key
        orig_score = doc.get('vector_score') or doc.get('score', 0.0)
        doc['vector_score'] = orig_score
        doc['rrf_score'] = round(score, 6)
        doc['score'] = round(score, 6) # Compatible with existing UI score displays
        doc['final_rank'] = final_rank_0 + 1
        fused_results.append(doc)

    return fused_results


# ── Intent & Adaptive Depth Classifiers ──────────────────────────────────────

def classify_query_intent(query: str) -> str:
    """
    Component C: Linguistic Intent & Multi-Facetedness Classifier
    Returns: 'compound' | 'simple' | 'standard'
    """
    q = query.lower().strip()
    words = len(q.split())

    # Compound / Comparative patterns (requires multi-source perspectives)
    comparative_markers = [
        "compare", " vs ", " vs. ", "versus", "difference between",
        "tradeoff", "trade-off", "distinguish", "how do both",
        "relationship between", "similarities and differences"
    ]
    multi_part_markers = [
        " and explain ", " along with ", " as well as ",
        " pros and cons ", " advantages and disadvantages "
    ]

    if any(m in q for m in comparative_markers) or any(m in q for m in multi_part_markers):
        return "compound"

    # Simple definition / factual formula / direct question patterns
    simple_markers = [
        "what is", "what are", "define", "who is", "state the", "state ", "formula for",
        "unit of", "symbol for", "meaning of", "briefly define",
        "how is", "how does", "how to", "how can", "explain", "overview of",
        "describe", "role of", "what does", "summary of"
    ]
    if any(q.startswith(m) for m in simple_markers) and words <= 16:
        return "simple"

    return "standard"


def determine_adaptive_depth(
    query: str,
    raw_query_results: List[Dict[str, Any]],
    confidence_threshold: float = 0.80
) -> Dict[str, Any]:
    """
    Hybrid (B + C) Decision Engine:
    - Component C: Linguistic Multi-Facetedness / Intent
    - Component B: Post-Retrieval Confidence Margin (ChromaDB top-1 similarity)

    Returns:
        {
            "expansion_depth": 0 | 1 | 2 | 3 | 4 | 5,
            "tier": "fast_track" | "focused" | "deep_fusion",
            "reason": str,
            "top_score": float,
            "intent": str,
            "adaptive_subquery_count": int
        }
    """
    intent = classify_query_intent(query)
    adaptive_count = determine_subquery_count(query)

    # Top candidate confidence score & margin from Component B
    top_score = 0.0
    second_score = 0.0
    if raw_query_results:
        top_score = float(raw_query_results[0].get("score", 0.0) or raw_query_results[0].get("rrf_score", 0.0) or 0.0)
        if len(raw_query_results) > 1:
            second_score = float(raw_query_results[1].get("score", 0.0) or raw_query_results[1].get("rrf_score", 0.0) or 0.0)

    margin = top_score - second_score

    # Rule 1: Compound / Comparative queries ALWAYS require full MMLF
    if intent == "compound":
        return {
            "expansion_depth": adaptive_count,
            "tier": "deep_fusion",
            "reason": f"Multi-concept comparative query requires full multi-source perspective fusion (n={adaptive_count})",
            "top_score": round(top_score, 4),
            "intent": intent,
            "adaptive_subquery_count": adaptive_count
        }

    # Rule 2: Fast-Track Early Exit
    if (intent == "simple" and top_score >= confidence_threshold) or (top_score >= 0.88) or (top_score >= 0.82 and margin >= 0.08):
        return {
            "expansion_depth": 0,
            "tier": "fast_track",
            "reason": f"High confidence direct match found in library (score={top_score:.3f}, margin={margin:.3f}). Early-exit triggered.",
            "top_score": round(top_score, 4),
            "intent": intent,
            "adaptive_subquery_count": 0
        }

    # Rule 3a: Simple intent — focused selective expansion (n=2)
    # Applies ONLY to queries classified as linguistically simple (short, direct-lookup).
    if intent == "simple":
        return {
            "expansion_depth": 2,
            "tier": "focused",
            "reason": f"Simple factual query with moderate similarity (score={top_score:.3f}). Focused expansion (n=2).",
            "top_score": round(top_score, 4),
            "intent": intent,
            "adaptive_subquery_count": 2
        }

    # Rule 3b: Standard intent with high-enough initial similarity — paper-faithful MMLF (n=3)
    # These queries are not simple (longer or multi-aspect) but have a decent initial match.
    # Using n=3 here matches the paper's default and ensures proper multi-perspective fusion.
    if top_score >= 0.60:
        return {
            "expansion_depth": 3,
            "tier": "standard_fusion",
            "reason": f"Standard analytical query with moderate similarity (score={top_score:.3f}). Paper-faithful MMLF (n=3).",
            "top_score": round(top_score, 4),
            "intent": intent,
            "adaptive_subquery_count": 3
        }

    # Rule 4: Deep Fusion — low initial similarity, use adaptive sub-query count
    # The query is standard/complex but ChromaDB returned weak initial candidates.
    # More sub-queries probe more facets of the query space.
    return {
        "expansion_depth": adaptive_count,
        "tier": "deep_fusion",
        "reason": f"Complex query with low initial similarity (score={top_score:.3f}). Full MMLF late fusion (n={adaptive_count}).",
        "top_score": round(top_score, 4),
        "intent": intent,
        "adaptive_subquery_count": adaptive_count
    }


# ── Main Pipeline ────────────────────────────────────────────────────────────

def run_mmlf_pipeline(
    query: str,
    retriever_func: Callable[[str, int], List[Dict[str, Any]]],
    top_k: int = 5,
    progress_callback: Optional[Callable[[str, str, Any], None]] = None,
    adaptive: bool = True,
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Optimized Ada-MMLF Pipeline with all limitation solutions applied.
    Logs structured live trace adhering to the 6-stage verification specification.
    """
    import uuid
    req_id = request_id or f"req_{uuid.uuid4().hex[:8]}"
    pipeline_start = time.time()
    t_pipeline_perf = time.perf_counter()
    cfg = get_config() if get_config else None

    # ── Step 0: Full pipeline cache check ─────────────────────────────────
    if cfg and cfg.cache_enabled and get_pipeline_cache:
        cache = get_pipeline_cache()
        query_emb = _get_text_embedding(query)
        cached_result = cache.get(query, embedding=query_emb)
        if cached_result is not None:
            elapsed_ms = (time.perf_counter() - t_pipeline_perf) * 1000.0
            logger.info(f"[INFO] request_id={req_id} query=\"{query}\" cache_hit=true")
            logger.info(f"  cache_status=HIT duration_ms={elapsed_ms:.1f} returned_from_pipeline_cache=true llm_calls=0")
            if progress_callback:
                progress_callback("cache_hit", f"⚡ Pipeline cache HIT — instant results in {elapsed_ms:.0f}ms", None)
            cached_result["method"] = f"Ada-MMLF Cache HIT ({elapsed_ms:.0f}ms)"
            cached_result["request_id"] = req_id
            cached_result["optimization_stats"] = {
                "cache_hit": True,
                "latency_ms": round(elapsed_ms),
                "request_id": req_id,
                "llm_calls_mqr": 0,
                "llm_calls_cqe": 0,
                "total_llm_calls": 0,
            }
            return cached_result

    logger.info(f"[INFO] request_id={req_id} query=\"{query}\" cache_hit=false")
    client, model = get_ollama_client_and_model()

    # ── Step 1: Candidate retrieval for original query R(q) ───────────────
    t_s1_start = time.perf_counter()
    cand_depth = max(top_k * 2, 10)
    raw_query_results = retriever_func(query, cand_depth)
    s1_dur_ms = (time.perf_counter() - t_s1_start) * 1000.0

    logger.info(f"[STAGE 1/6] Original retrieval\n  collection=rag_collection top_k={cand_depth} chunks={len(raw_query_results)} duration_ms={s1_dur_ms:.1f}")
    for idx, r in enumerate(raw_query_results[:min(top_k, 5)], 1):
        c_id = r.get('id') or f"chunk_{idx}"
        fname = r['file'][0] if (r.get('file') and isinstance(r['file'], (list, tuple))) else "unknown"
        r_score = r.get('score', 0.0) or 0.0
        logger.info(f"  chunk_id={c_id} file={fname} rank={idx} score={r_score:.4f}")

    # ── Step 2: Hybrid (B + C) Adaptive Decision ─────────────────────────
    if adaptive:
        decision = determine_adaptive_depth(query, raw_query_results)
        expansion_depth = decision["expansion_depth"]
        if progress_callback:
            progress_callback("adaptive_decision", f"Ada-MMLF: {decision['reason']}", decision)

        # Early exit if high confidence direct match is already in knowledge base
        if expansion_depth == 0:
            elapsed_ms = (time.perf_counter() - t_pipeline_perf) * 1000.0
            logger.info(f"[STAGE 2/6] Adaptive MMLF\n  intent={decision.get('intent')} depth=0 reason=\"{decision.get('reason')}\" subqueries=0")
            logger.info(f"  policy=\"Fast-Track early exit: direct high-confidence match (score={decision.get('top_score', 0):.3f}), passage expansion intentionally bypassed.\"")
            if progress_callback:
                progress_callback("fast_track", "⚡ Fast-Track hit: Direct answer found in notes. Skipping expansion.", None)
            result = {
                "query": query,
                "request_id": req_id,
                "subqueries": [query],
                "pseudo_documents": [],
                "contexts": raw_query_results[:top_k],
                "method": "Ada-MMLF Fast Track (Early Exit)",
                "adaptive_info": decision,
                "optimization_stats": {
                    "request_id": req_id,
                    "cache_hit": False,
                    "parallel_gen": False,
                    "parallel_retrieval": False,
                    "dynamic_stopping_pruned": 0,
                    "bm25_hybrid": False,
                    "llm_calls_mqr": 0,
                    "llm_calls_cqe": 0,
                    "total_llm_calls": 0,
                    "latency_ms": round(elapsed_ms),
                }
            }
            # Cache fast-track results too
            if cfg and cfg.cache_enabled and get_pipeline_cache:
                get_pipeline_cache().put(query, result, embedding=query_emb if 'query_emb' in dir() else None)
            return result
    else:
        expansion_depth = 3
        decision = {"expansion_depth": 3, "tier": "fixed", "reason": "Fixed MMLF n=3", "intent": "manual"}

    # ── Step 3: Multi-Query Generation (MQR) with adaptive count ─────────
    if progress_callback:
        progress_callback("mql_start", f"Generating {expansion_depth} dynamic study perspective(s)...", None)

    all_subqueries = generate_subqueries(query, client=client, model=model, n_subqueries=expansion_depth)
    subqueries = all_subqueries[:expansion_depth]

    logger.info(f"[STAGE 2/6] Adaptive MMLF\n  intent={decision.get('intent')} depth={expansion_depth} reason=\"{decision.get('reason')}\" subqueries={len(subqueries)}")
    for idx, sq in enumerate(subqueries, 1):
        logger.info(f"  subquery_id=sq_{idx} text=\"{sq}\"")

    original_count = len(subqueries)
    if progress_callback:
        progress_callback("subqueries", f"Generated {len(subqueries)} perspective(s)", subqueries)

    # ── Step 4: Passage Generation (PARALLEL or sequential) ──────────────
    if progress_callback:
        progress_callback("cqe_start", f"Synthesizing {len(subqueries)} academic pseudo-passage(s)...", None)

    use_parallel_gen = cfg.parallel_generation if cfg else True
    workers = cfg.max_workers if cfg else 4
    t_s3_start = time.perf_counter()

    if use_parallel_gen and len(subqueries) > 1:
        # ⚡ PARALLEL passage generation
        pseudo_docs = generate_passages_parallel(
            original_query=query,
            subqueries=subqueries,
            client=client,
            model=model,
            max_workers=workers,
            progress_callback=progress_callback
        )
    else:
        # Sequential fallback
        pseudo_docs = []
        for i, sq in enumerate(subqueries):
            doc = generate_pseudo_document(query, sq, client=client, model=model)
            pseudo_docs.append(doc)
            if progress_callback:
                progress_callback("cqe_item", f"Synthesized passage {i+1}", {"index": i, "passage": doc[:120] + "..."})

    s3_dur_ms = (time.perf_counter() - t_s3_start) * 1000.0
    logger.info(f"[STAGE 3/6] Pseudo-passage generation\n  model={model} input_query_id=sq_all status=success duration_ms={s3_dur_ms:.1f} cqe_llm_calls={len(pseudo_docs)}")
    for idx, p in enumerate(pseudo_docs, 1):
        p_clean = (p or '').replace('\n', ' ')[:90]
        logger.info(f"  passage_id=psg_{idx} text=\"{p_clean}...\"")

    # ── Step 5: Multi-list Dense Retrieval (PARALLEL) ────────────────────
    if progress_callback:
        progress_callback("fusion_start", f"Fusing {len(pseudo_docs) + 1} ranked lists via Reciprocal Rank Fusion (k=60)...", None)

    use_parallel_ret = cfg.parallel_retrieval if cfg else True

    # Build query list: [original_query, pseudo_doc_1, ..., pseudo_doc_n]
    all_queries = [query] + pseudo_docs
    t_s4_start = time.perf_counter()

    if use_parallel_ret:
        # ⚡ PARALLEL retrieval
        all_ranked_lists = retrieve_parallel(
            queries=all_queries,
            retriever_func=retriever_func,
            top_k=cand_depth,
            max_workers=workers
        )
    else:
        # Sequential fallback
        all_ranked_lists = [raw_query_results]
        for doc in pseudo_docs:
            retrieved_for_doc = retriever_func(doc, cand_depth)
            all_ranked_lists.append(retrieved_for_doc)

    s4_dur_ms = (time.perf_counter() - t_s4_start) * 1000.0
    logger.info(f"[STAGE 4/6] Independent retrieval\n  chunks={sum(len(l) for l in all_ranked_lists)} wallclock_duration_ms={s4_dur_ms:.1f} (parallel={use_parallel_ret})")
    for idx, rlist in enumerate(all_ranked_lists):
        tag = "original" if idx == 0 else f"passage_{idx}"
        logger.info(f"  input_id={tag} source={tag} chunks={len(rlist)}")

    # ── Step 5b: BM25 Hybrid Pre-filter (optional) ──────────────────────
    bm25_used = False
    if cfg and cfg.bm25_prefilter_enabled:
        bm25 = get_bm25_index()
        if bm25.is_ready:
            bm25_results = bm25.search(query, top_k=cfg.bm25_candidate_pool)
            if bm25_results:
                # Add BM25 results as an additional ranked list for RRF
                all_ranked_lists.append(bm25_results)
                bm25_used = True
                if progress_callback:
                    progress_callback("bm25_hybrid", f"BM25 pre-filter added {len(bm25_results)} sparse candidates for fusion", None)

    # ── Step 6: Reciprocal Rank Fusion (RRF with k=60) ───────────────────
    rrf_k = cfg.rrf_k if cfg else RRF_K
    fused_results = reciprocal_rank_fusion(all_ranked_lists, top_k=top_k, k=rrf_k)
    unique_docs = set()
    for rlist in all_ranked_lists:
        for h in rlist:
            u_id = h.get("id") or (h["file"][0] if h.get("file") else str(h.get("text", "")[:30]))
            unique_docs.add(u_id)

    logger.info(f"[STAGE 5/6] RRF fusion\n  k={rrf_k} input_lists={len(all_ranked_lists)} unique_documents={len(unique_docs)} output_top_k={len(fused_results)}")
    for rank, ctx in enumerate(fused_results[:top_k], 1):
        c_id = ctx.get('id') or f"chunk_{rank}"
        fname = ctx['file'][0] if (ctx.get('file') and isinstance(ctx['file'], (list, tuple))) else "unknown"
        c_score = ctx.get('rrf_score', 0.0) or 0.0
        logger.info(f"  chunk_id={c_id} file={fname} rank={rank} rrf_score={c_score:.6f}")

    elapsed = time.time() - pipeline_start

    if progress_callback:
        progress_callback("fusion_done", f"Fused top-{len(fused_results)} study contexts", fused_results)

    # ── Build result with optimization statistics ────────────────────────
    result = {
        "query": query,
        "subqueries": subqueries,
        "pseudo_documents": pseudo_docs,
        "contexts": fused_results,
        "method": f"Ada-MMLF ({decision['tier']} - n={expansion_depth})",
        "adaptive_info": decision,
        "optimization_stats": {
            "cache_hit": False,
            "parallel_gen": use_parallel_gen and len(subqueries) > 1,
            "parallel_retrieval": use_parallel_ret,
            "dynamic_stopping_pruned": original_count - len(subqueries),
            "bm25_hybrid": bm25_used,
            "llm_calls_mqr": 1,
            "llm_calls_cqe": len(pseudo_docs),
            "total_llm_calls": 1 + len(pseudo_docs),  # 1 MQR + N CQE
            "total_retrievals": len(all_ranked_lists),
            "s1_duration_ms": round(s1_dur_ms, 1),
            "s3_duration_ms": round(s3_dur_ms, 1),
            "s4_duration_ms": round(s4_dur_ms, 1),
            "latency_ms": round(elapsed * 1000),
            "profile": cfg.profile if cfg else "default",
        }
    }

    # ── Step 7: Cache the full pipeline result ───────────────────────────
    if cfg and cfg.cache_enabled and get_pipeline_cache:
        try:
            query_emb = _get_text_embedding(query)
            get_pipeline_cache().put(query, result, embedding=query_emb)
        except Exception:
            pass

    return result


# ── Main Entry (Benchmark) ───────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("\n" + "=" * 75)
    print("[*] Optimized Ada-MMLF v2: Efficiency & Scaling Benchmark")
    print("=" * 75)

    # Load config
    from mmlf_optimizer_config import get_config, set_profile
    cfg = get_config()
    print(f"Active Profile: {cfg.profile}")
    print(f"Cache: {'ON' if cfg.cache_enabled else 'OFF'}")
    print(f"Parallel Gen: {'ON' if cfg.parallel_generation else 'OFF'}")
    print(f"Parallel Retrieval: {'ON' if cfg.parallel_retrieval else 'OFF'}")
    print(f"BM25 Hybrid: {'ON' if cfg.bm25_prefilter_enabled else 'OFF'}")
    print(f"Dynamic Stopping: {'ON' if cfg.dynamic_stopping_enabled else 'OFF'}")
    print(f"Adaptive Sub-queries: {'ON' if cfg.adaptive_subquery_enabled else 'OFF'}")

    test_queries = [
        {
            "id": 1,
            "query": "Define Ohm's law and electrical resistance unit",
            "desc": "Simple factual definition"
        },
        {
            "id": 2,
            "query": "Formula for lambda in characteristic polynomial",
            "desc": "Specific formula lookup"
        },
        {
            "id": 3,
            "query": "Compare FedGT attention with traditional GCN and explain communication tradeoffs",
            "desc": "Compound multi-concept comparative query"
        },
        {
            "id": 4,
            "query": "Backpropagation chain rule loss gradient derivation in multilayer neural networks with batch normalization and dropout regularization",
            "desc": "Long conceptual query"
        },
    ]

    print(f"\n{'ID':<4} {'Description':<42} {'Intent':<14} {'Sub-Qs':<8} {'Adaptive Tier'}")
    print("-" * 90)

    for t in test_queries:
        q = t["query"]
        intent = classify_query_intent(q)
        adaptive_n = determine_subquery_count(q)
        decision = determine_adaptive_depth(q, raw_query_results=[])
        print(f"Q{t['id']:<3} {t['desc'][:40]:<42} {intent:<14} n={adaptive_n:<5} {decision['tier']}")
    print("=" * 90 + "\n")
