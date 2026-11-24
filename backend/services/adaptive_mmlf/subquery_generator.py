"""
Subquery Generator: Stage 4 of Adaptive MMLF Pipeline
Generates 1 to 5 targeted, diverse sub-queries using local LLMs.
Uses asyncio.to_thread with strict timeout, robust output parsing,
and fail-safe heuristic fallbacks.
"""

import asyncio
import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)


TECHNICAL_PROMPT_CONTEXT = (
    "You are an expert technical research assistant specializing in computer science, "
    "engineering, and machine learning systems. Deconstruct technical nuances, mechanisms, and trade-offs."
)

GENERAL_PROMPT_CONTEXT = (
    "You are a helpful research assistant. Deconstruct the user inquiry into clear, "
    "targeted sub-topics covering fundamental aspects, real-world context, and key details."
)


class SubqueryGenerator:
    """
    Asynchronously generates exactly N distinct, relevant sub-queries from a root query.
    """

    def __init__(
        self,
        ollama_host: str = "http://127.0.0.1:11434",
        default_model: str = "llama3.2:latest",
        timeout: float = 15.0
    ):
        self.ollama_host = ollama_host
        self.default_model = default_model
        self.timeout = timeout

    def build_prompt(self, query: str, count: int, is_technical: bool = False) -> str:
        """
        Builds clear prompt specifying exact count and output format.
        """
        context = TECHNICAL_PROMPT_CONTEXT if is_technical else GENERAL_PROMPT_CONTEXT
        format_examples = "\n".join([f"Sub-query {i}: <concise sub-query>" for i in range(1, count + 1)])

        prompt = (
            f"{context}\n\n"
            f"Original Query: \"{query}\"\n\n"
            f"Generate exactly {count} distinct, concise sub-queries that break down this topic into specific angles.\n"
            f"Each sub-query must be focused, different from the others, and shorter than a paragraph.\n"
            f"You MUST format your response EXACTLY as follows with no intro or outro text:\n\n"
            f"{format_examples}\n"
        )
        return prompt

    def parse_subqueries(self, response_text: str, query: str, expected_count: int) -> List[str]:
        """
        Parses LLM response into a list of exactly `expected_count` sub-queries.
        Handles variations, extra whitespace, markdown numbering, and fallbacks.
        """
        if not response_text or not response_text.strip():
            return self._heuristic_fallback(query, expected_count)

        lines = [line.strip() for line in response_text.strip().split("\n") if line.strip()]
        subqueries: List[str] = []

        # Regex patterns to detect subquery lines
        pattern_strict = re.compile(r"^Sub-query\s*\d+\s*:\s*(.*)$", re.IGNORECASE)
        pattern_numbered = re.compile(r"^\d+[\.\)]\s*(.*)$")
        pattern_bullet = re.compile(r"^[-*•]\s*(.*)$")

        for line in lines:
            extracted = None
            m = pattern_strict.match(line)
            if m:
                extracted = m.group(1).strip()
            else:
                m = pattern_numbered.match(line)
                if m:
                    extracted = m.group(1).strip()
                else:
                    m = pattern_bullet.match(line)
                    if m:
                        extracted = m.group(1).strip()

            if extracted:
                # Clean quotes and markdown bolding
                extracted = re.sub(r"^[\"'\*]+|[\"'\*]+$", "", extracted).strip()
                if extracted and len(extracted) > 3 and extracted.lower() not in [sq.lower() for sq in subqueries]:
                    subqueries.append(extracted)

        # Fallback if parsing found nothing
        if not subqueries:
            for line in lines:
                clean_line = re.sub(r"^[\"'\*]+|[\"'\*]+$", "", line).strip()
                if len(clean_line) > 10 and clean_line.lower() not in [sq.lower() for sq in subqueries]:
                    subqueries.append(clean_line)

        # Final guarantee: exactly expected_count items, distinct and non-empty
        if len(subqueries) < expected_count:
            # Pad with heuristic variations of the original query
            fallbacks = self._heuristic_fallback(query, expected_count)
            for fb in fallbacks:
                if len(subqueries) >= expected_count:
                    break
                if fb.lower() not in [s.lower() for s in subqueries]:
                    subqueries.append(fb)

        # Truncate if more than expected
        return subqueries[:expected_count]

    def _heuristic_fallback(self, query: str, count: int) -> List[str]:
        """
        High-quality heuristic decomposition when LLM is unavailable or fails.
        """
        clean_q = query.strip()
        templates = [
            clean_q,
            f"Core mechanisms and theoretical foundations of {clean_q}",
            f"Practical implementations, architecture, and examples of {clean_q}",
            f"Performance comparison, benchmarks, and limitations of {clean_q}",
            f"Recent advances and best practices in {clean_q}"
        ]
        results = templates[:count]
        while len(results) < count:
            results.append(f"{clean_q} perspective {len(results) + 1}")
        return results

    def _call_ollama_sync(self, prompt: str, model: str) -> str:
        """Synchronous Ollama invocation run in a worker thread."""
        try:
            import ollama
            client = ollama.Client(host=self.ollama_host)
            response = client.generate(
                model=model,
                prompt=prompt,
                options={"temperature": 0.3, "top_p": 0.9}
            )
            return response.get("response", "")
        except Exception as e:
            logger.warning(f"Ollama subquery generation sync call failed: {e}")
            raise e

    async def generate(
        self,
        query: str,
        count: int = 3,
        model: Optional[str] = None,
        is_technical: bool = False
    ) -> List[str]:
        """
        Generates exactly `count` sub-queries asynchronously with timeout and graceful fallback.
        """
        clean_q = (query or "").strip()
        if not clean_q:
            return []

        target_count = max(1, min(5, int(count)))
        target_model = model or self.default_model

        if target_count == 1:
            # For 1 sub-query, return the original query directly
            return [clean_q]

        prompt = self.build_prompt(clean_q, target_count, is_technical=is_technical)

        try:
            raw_output = await asyncio.wait_for(
                asyncio.to_thread(self._call_ollama_sync, prompt, target_model),
                timeout=self.timeout
            )
            subqueries = self.parse_subqueries(raw_output, clean_q, target_count)
            return subqueries
        except asyncio.TimeoutError:
            logger.warning(f"[SubqueryGenerator] Timeout ({self.timeout}s) generating sub-queries for: '{clean_q}'. Falling back.")
            return self._heuristic_fallback(clean_q, target_count)
        except Exception as e:
            logger.warning(f"[SubqueryGenerator] Failed to call model '{target_model}': {e}. Using fallback.")
            return self._heuristic_fallback(clean_q, target_count)
