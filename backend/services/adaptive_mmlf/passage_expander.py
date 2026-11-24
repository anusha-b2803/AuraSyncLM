"""
Passage Expander: Stage 5 of Adaptive MMLF Pipeline
Implements Cross-Query Expansion (CQE) by generating synthetic pseudo-documents.
Each passage answers BOTH the original query (Question 1) and sub-query (Question 2) simultaneously.
Runs in parallel using asyncio.gather with batching constrained by max_parallel.
"""

import asyncio
import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)


CQE_TEMPLATE = """You are an academic tutor and technical subject matter expert.
Write a detailed, comprehensive, and informative passage that simultaneously answers BOTH of the following questions:

Question 1: {original_query}
Question 2: {subquery}

Requirements:
- Thoroughly explain the key concepts, mechanisms, and factual context connecting Question 1 and Question 2.
- The passage should be detailed, coherent, and rich in domain terminology.
- Format your response starting with:
Passage:
"""


class PassageExpander:
    """
    Asynchronously expands sub-queries into detailed pseudo-passages using CQE.
    Batches concurrent requests to respect max_parallel resource limits.
    """

    def __init__(
        self,
        ollama_host: str = "http://127.0.0.1:11434",
        default_model: str = "llama3.2:latest",
        timeout: float = 25.0
    ):
        self.ollama_host = ollama_host
        self.default_model = default_model
        self.timeout = timeout

    def build_cqe_prompt(self, original_query: str, subquery: str) -> str:
        """
        Builds the CQE prompt combining original query and sub-query.
        """
        return CQE_TEMPLATE.format(
            original_query=original_query.strip(),
            subquery=subquery.strip()
        )

    def parse_passage(self, response_text: str) -> str:
        """
        Parses LLM generation after the 'Passage:' marker.
        Strips surrounding quotation marks and redundant prefixes.
        """
        if not response_text or not response_text.strip():
            return ""

        text = response_text.strip()
        # Look for Passage: marker
        match = re.search(r"Passage\s*:\s*(.*)", text, re.DOTALL | re.IGNORECASE)
        if match:
            extracted = match.group(1).strip()
            if extracted:
                return extracted

        # If no marker found, clean and return whole response
        return text

    def _call_ollama_sync(self, prompt: str, model: str) -> str:
        """Synchronous Ollama call executed inside asyncio.to_thread."""
        try:
            import ollama
            client = ollama.Client(host=self.ollama_host)
            resp = client.generate(
                model=model,
                prompt=prompt,
                options={"temperature": 0.4, "top_p": 0.9, "num_predict": 300}
            )
            return resp.get("response", "")
        except Exception as e:
            logger.warning(f"Ollama CQE generation call failed: {e}")
            raise e

    async def expand_single(
        self,
        original_query: str,
        subquery: str,
        model: str,
        simulate_failure: bool = False
    ) -> str:
        """
        Expands a single sub-query into a pseudo-document.
        If generation fails, logs error and returns empty string fallback.
        """
        if simulate_failure:
            logger.error(f"[PassageExpander] Simulated expansion failure for subquery: '{subquery}'")
            return ""

        prompt = self.build_cqe_prompt(original_query, subquery)

        try:
            raw_text = await asyncio.wait_for(
                asyncio.to_thread(self._call_ollama_sync, prompt, model),
                timeout=self.timeout
            )
            passage = self.parse_passage(raw_text)
            if not passage:
                logger.warning(f"[PassageExpander] Empty parsed passage for: '{subquery}'")
                return ""
            return passage
        except asyncio.TimeoutError:
            logger.error(f"[PassageExpander] Timeout generating passage for '{subquery}'")
            return ""
        except Exception as e:
            logger.error(f"[PassageExpander] Error expanding passage for '{subquery}': {e}")
            # Checklist requirement: Failed passage replaced with empty string fallback
            return ""

    async def expand(
        self,
        original_query: str,
        subqueries: List[str],
        max_parallel: int = 3,
        model: Optional[str] = None,
        simulate_failure: bool = False
    ) -> List[str]:
        """
        Parallel CQE expansion over sub-queries in batches of max_parallel.
        Uses asyncio.gather for parallel processing within each batch.
        """
        if not subqueries:
            return []

        target_model = model or self.default_model
        batch_size = max(1, int(max_parallel))
        all_passages: List[str] = []

        # Process in batches respecting max_parallel
        for i in range(0, len(subqueries), batch_size):
            batch = subqueries[i:i + batch_size]
            tasks = [
                self.expand_single(
                    original_query=original_query,
                    subquery=sq,
                    model=target_model,
                    simulate_failure=simulate_failure
                )
                for sq in batch
            ]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for res in batch_results:
                if isinstance(res, Exception):
                    logger.error(f"[PassageExpander] Unhandled exception in batch: {res}")
                    all_passages.append("")
                else:
                    all_passages.append(res if isinstance(res, str) else "")

        return all_passages
