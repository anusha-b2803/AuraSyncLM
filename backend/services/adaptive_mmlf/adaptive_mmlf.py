"""
Adaptive MMLF Pipeline: Main Orchestration Engine
Integrates Query Analysis, Caching, Resource Monitoring, Subquery Generation,
Cross-Query Expansion, Parallel Retrieval, and Weighted RRF Late Fusion.
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional, Callable

from .query_analyzer import QueryAnalyzer
from .cache_manager import CacheManager
from .resource_monitor import ResourceMonitor
from .subquery_generator import SubqueryGenerator
from .passage_expander import PassageExpander
from .retriever import AdaptiveRetriever
from .rrf_fusion import RRFFusion

logger = logging.getLogger(__name__)


class AdaptiveMMLF:
    """
    Main pipeline orchestrator for Adaptive Multi-query Multi-passage Late Fusion.
    Executes stages conditionally based on query complexity and system resources.
    """

    def __init__(
        self,
        cache_ttl: float = 3600.0,
        cache_max_size: int = 500,
        fast_model: str = "llama3.2:latest",
        smart_model: str = "llama3.2:latest",
        chroma_dir: Optional[str] = None,
        ollama_host: str = "http://127.0.0.1:11434"
    ):
        self.query_analyzer = QueryAnalyzer()
        self.cache_manager = CacheManager(ttl=cache_ttl, max_size=cache_max_size)
        self.resource_monitor = ResourceMonitor(
            fast_model=fast_model,
            smart_model=smart_model,
            ollama_host=ollama_host
        )
        self.subquery_generator = SubqueryGenerator(
            ollama_host=ollama_host,
            default_model=smart_model
        )
        self.passage_expander = PassageExpander(
            ollama_host=ollama_host,
            default_model=smart_model
        )
        self.retriever = AdaptiveRetriever(chroma_dir=chroma_dir)
        self.rrf = RRFFusion(k=60)

    async def search(
        self,
        query: str,
        mode: Optional[str] = None,  # 'fast', 'smart', or None (auto)
        progress_callback: Optional[Callable[[str, str, Dict[str, Any]], None]] = None,
        top_k: int = 10
    ) -> Dict[str, Any]:
        """
        Executes the Adaptive MMLF Search pipeline.
        Stages:
        1. Cache Check (BEFORE any LLM calls)
        2. Query Analysis (complexity, ambiguity, subquery count)
        3. Resource Check (RAM, CPU, model selection)
        4. Mode Determination (fast vs smart)
        5. Execution:
           - Fast Mode: Single direct retrieval, bypasses stages 4 & 5
           - Smart Mode: Subquery generation -> Passage expansion -> Parallel retrieval -> RRF fusion
        6. Cache Store & Top 10 result trimming
        """
        start_time = time.time()
        clean_query = (query or "").strip()

        # Handle empty query gracefully
        if not clean_query:
            return {
                "results": [],
                "subqueries": [],
                "passages_count": 0,
                "mode": "fast",
                "complexity": 0.0,
                "source": "direct",
                "query": "",
                "duration_ms": 0.0
            }

        def report(stage: str, message: str, extra: Optional[Dict[str, Any]] = None):
            logger.info(f"[AdaptiveMMLF:{stage}] {message}")
            if progress_callback:
                try:
                    progress_callback(stage, message, extra or {})
                except Exception as e:
                    logger.debug(f"Progress callback error: {e}")

        # ---------------------------------------------------------
        # STAGE 0: CACHE CHECK (BEFORE ANY LLM CALLS)
        # ---------------------------------------------------------
        cached_result = self.cache_manager.get(clean_query)
        if cached_result is not None:
            report("cache_hit", "Found cached results ⚡", {"query": clean_query})
            # Clone and mark source as cache
            res = dict(cached_result)
            res["source"] = "cache"
            res["duration_ms"] = round((time.time() - start_time) * 1000, 2)
            return res

        # ---------------------------------------------------------
        # STAGE 1: QUERY ANALYSIS
        # ---------------------------------------------------------
        report("analyzing", "Analyzing query complexity...")
        analysis = self.query_analyzer.analyze(clean_query, force_mode=mode)
        complexity = analysis["complexity"]
        suggested_subqueries = analysis["subquery_count"]

        # ---------------------------------------------------------
        # STAGE 2: RESOURCE MONITORING
        # ---------------------------------------------------------
        resource_status = self.resource_monitor.evaluate()
        ram_ok = resource_status["ram_available_gb"] > 8.0
        cpu_ok = resource_status["cpu_usage_percent"] < 80.0
        resources_sufficient = ram_ok and cpu_ok
        max_parallel = resource_status["max_parallel"]

        # ---------------------------------------------------------
        # STAGE 3: MODE DECISION
        # ---------------------------------------------------------
        # Checklist: Mode can be overridden by force_mode / mode parameter
        if mode == "fast":
            effective_mode = "fast"
        elif mode == "smart":
            effective_mode = "smart"
        else:
            # Auto mode:
            # - Triggers fast mode if complexity < 0.3 OR resources insufficient
            # - Triggers smart mode if complexity >= 0.3 AND resources sufficient
            if complexity < 0.3 or not resources_sufficient:
                effective_mode = "fast"
            else:
                effective_mode = "smart"

        # STAGE 1: Original-Query Retrieval from ChromaDB
        report("direct_search", "Retrieving candidate contexts for original query from ChromaDB...")
        try:
            orig_doc_ids = await self.retriever.query_single_async(clean_query, n_results=top_k)
        except Exception as e:
            logger.error(f"[AdaptiveMMLF] Direct retrieval error: {e}")
            orig_doc_ids = []
        logger.info(f"[STAGE 1/6] Original-query retrieval from ChromaDB: Retrieved {len(orig_doc_ids)} candidate chunks for query: '{clean_query}'")
        for idx, doc_id in enumerate(orig_doc_ids[:3], 1):
            logger.info(f"  [Chunk {idx}] DocID: {doc_id}")

        # ---------------------------------------------------------
        # FAST MODE PATH (Bypasses Subqueries & Expansion)
        # ---------------------------------------------------------
        if effective_mode == "fast":
            final_results = orig_doc_ids[:top_k]
            duration = round((time.time() - start_time) * 1000, 2)

            response_data = {
                "results": final_results,
                "subqueries": [clean_query],
                "passages_count": 0,
                "mode": "fast",
                "complexity": complexity,
                "source": "direct",
                "query": clean_query,
                "duration_ms": duration
            }

            # Cache successful response
            self.cache_manager.set(clean_query, response_data)
            report("complete", "Search complete (Fast Mode)", {"count": len(final_results)})
            logger.info(f"[STAGE 2/6] Adaptive decision: Fast Mode triggered (complexity={complexity:.2f} < 0.3), returning direct ChromaDB results.")
            return response_data

        # ---------------------------------------------------------
        # SMART MODE PATH (Full Stages)
        # ---------------------------------------------------------
        chosen_model = resource_status["selected_model"]
        report("generating", f"Generating {suggested_subqueries} sub-queries...", {"count": suggested_subqueries})

        # STAGE 2: Adaptive Decision & Sub-query Generation
        try:
            subqueries = await self.subquery_generator.generate(
                query=clean_query,
                count=suggested_subqueries,
                model=chosen_model,
                is_technical=analysis["is_technical"]
            )
        except Exception as e:
            logger.warning(f"[AdaptiveMMLF] Subquery generation failed: {e}. Falling back to original query.")
            subqueries = [clean_query]

        logger.info(f"[STAGE 2/6] Adaptive decision and generated sub-queries: Mode='{effective_mode}', Complexity={complexity:.2f}, Subqueries count={len(subqueries)}")
        for idx, sq in enumerate(subqueries, 1):
            logger.info(f"  [Sub-query {idx}] {sq}")

        # STAGE 3: Cross-Query Expansion (CQE)
        report("expanding", f"Expanding {len(subqueries)} synthetic passages in parallel...", {"subqueries": subqueries})
        try:
            passages = await self.passage_expander.expand(
                original_query=clean_query,
                subqueries=subqueries,
                max_parallel=max_parallel,
                model=chosen_model
            )
        except Exception as e:
            logger.warning(f"[AdaptiveMMLF] Passage expansion failed: {e}. Proceeding without passages.")
            passages = []

        # Filter empty passages
        valid_passages = [p for p in passages if p and p.strip()]
        logger.info(f"[STAGE 3/6] Pseudo-passage generation using configured Ollama model '{chosen_model}': Synthesized {len(valid_passages)} passage(s)")
        for idx, p in enumerate(valid_passages, 1):
            p_clean = p.replace('\n', ' ')[:100]
            logger.info(f"  [Passage {idx}] {p_clean}...")

        # STAGE 4: Parallel Retrieval (Original Query + All Passages)
        report("retrieving", f"Searching library across {len(valid_passages) + 1} perspectives in parallel...")
        try:
            ranked_lists = await self.retriever.retrieve_parallel(
                original_query=clean_query,
                passages=valid_passages,
                n_results=20
            )
        except Exception as e:
            logger.error(f"[AdaptiveMMLF] Parallel retrieval failed: {e}")
            ranked_lists = []

        logger.info(f"[STAGE 4/6] Independent retrieval for original query and each generated passage: Executed {len(ranked_lists)} parallel vector searches across ChromaDB")
        for idx, rlist in enumerate(ranked_lists):
            tag = "Original Query" if idx == 0 else f"Passage {idx}"
            logger.info(f"  [{tag}] Retrieved {len(rlist)} documents")

        # STAGE 5: Weighted RRF Late Fusion
        report("fusing", "Fusing perspective ranks via Weighted RRF (k=60)...")
        weights = self.rrf.calculate_weights(complexity, len(valid_passages))
        fused_doc_ids = self.rrf.fuse(ranked_lists, weights=weights, k=60)

        # Trim final results to top_k (default 10)
        final_results = fused_doc_ids[:top_k]
        duration = round((time.time() - start_time) * 1000, 2)

        logger.info(f"[STAGE 5/6] RRF fusion and final retrieved contexts: Fused {len(ranked_lists)} lists (k=60) into top-{len(final_results)} contexts")
        for idx, doc_id in enumerate(final_results, 1):
            logger.info(f"  [Context {idx}] DocID: {doc_id}")

        response_data = {
            "results": final_results,
            "subqueries": subqueries,
            "passages_count": len(valid_passages),
            "mode": "smart",
            "complexity": complexity,
            "source": "adaptive_mmlf",
            "query": clean_query,
            "duration_ms": duration
        }

        # Store in cache
        self.cache_manager.set(clean_query, response_data)
        report("complete", "Search complete (Smart Mode)", {"count": len(final_results)})
        return response_data
