"""
Retriever: Stage 6 of Adaptive MMLF Pipeline
Integrates with ChromaDB for dense semantic retrieval.
Executes parallel multi-perspective retrieval using asyncio.gather across
the original query and all generated pseudo-passages simultaneously (N + 1 parallel retrievals).
"""

import asyncio
import logging
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class AdaptiveRetriever:
    """
    ChromaDB-backed retriever that queries original query and pseudo-passages concurrently.
    Returns ranked lists of document IDs.
    """

    def __init__(
        self,
        chroma_dir: Optional[str] = None,
        collection_name: str = "rag_collection",
        user_id: str = "default"
    ):
        self.user_id = user_id
        self.collection_name = collection_name
        self._custom_chroma_dir = chroma_dir
        self._mock_data: Optional[Dict[str, List[str]]] = None  # For isolated testing

    def get_chroma_dir(self) -> str:
        """Resolves the user's ChromaDB storage directory."""
        if self._custom_chroma_dir:
            return self._custom_chroma_dir
        try:
            from main import get_user_paths
            paths = get_user_paths(self.user_id)
            return paths.get("chroma_dir", os.path.join(os.path.expanduser("~"), ".aurasync-lm", self.user_id, "chroma_db"))
        except Exception:
            return os.path.join(os.path.expanduser("~"), ".aurasync-lm", self.user_id, "chroma_db")

    def get_collection(self):
        """Safely gets ChromaDB collection if available and exists."""
        chroma_dir = self.get_chroma_dir()
        if not os.path.exists(chroma_dir):
            return None

        try:
            import chromadb
            client = chromadb.PersistentClient(path=chroma_dir)
            try:
                return client.get_collection(name=self.collection_name)
            except Exception:
                return None
        except Exception as e:
            logger.error(f"[AdaptiveRetriever] ChromaDB connection failed: {e}")
            return None

    def get_embedding(self, text: str) -> Optional[List[float]]:
        """
        Embeds text using SentenceTransformer (all-MiniLM-L6-v2) or Ollama fallback.
        Truncates long text to prevent model buffer overflows.
        """
        if not text or not text.strip():
            return None

        # Handle very long passage text safely (up to 8,000 characters)
        safe_text = text.strip()[:8000]

        try:
            from models import get_models
            model, _ = get_models()
            if model is not None:
                return model.encode(safe_text).tolist()
        except Exception as e:
            logger.debug(f"[AdaptiveRetriever] Local SentenceTransformer error: {e}")

        # Fallback to chatbot get_embedding
        try:
            from chatbot import get_embedding as chatbot_emb
            return chatbot_emb(safe_text)
        except Exception:
            return None

    def set_mock_index(self, mock_results_map: Dict[str, List[str]]):
        """Allows testing without a live ChromaDB collection."""
        self._mock_data = mock_results_map

    def query_single(self, text: str, n_results: int = 20) -> List[str]:
        """
        Queries ChromaDB for a single text string (query or passage).
        Returns a list of document IDs in rank order (most relevant first).
        """
        if not text or not text.strip():
            return []

        # If running in mock test mode
        if self._mock_data is not None:
            # Match text or return default mock list
            for key, doc_ids in self._mock_data.items():
                if key in text.lower():
                    return doc_ids[:n_results]
            return self._mock_data.get("__default__", ["doc_default_1", "doc_default_2"])[:n_results]

        collection = self.get_collection()
        if collection is None:
            logger.debug("[AdaptiveRetriever] Collection not found or ChromaDB not initialized.")
            return []

        emb = self.get_embedding(text)
        if emb is None:
            return []

        try:
            results = collection.query(
                query_embeddings=[emb],
                n_results=n_results
            )

            if not results or not results.get("ids") or not results["ids"][0]:
                return []

            doc_ids = results["ids"][0]
            # Ensure all IDs are strings and ranked
            return [str(d_id) for d_id in doc_ids]
        except Exception as e:
            logger.error(f"[AdaptiveRetriever] Query error: {e}")
            return []

    async def query_single_async(self, text: str, n_results: int = 20) -> List[str]:
        """Async non-blocking wrapper around query_single."""
        return await asyncio.to_thread(self.query_single, text, n_results)

    async def retrieve_parallel(
        self,
        original_query: str,
        passages: List[str],
        n_results: int = 20
    ) -> List[List[str]]:
        """
        Retrieves documents for original query + all passages concurrently using asyncio.gather.
        Total retrievals = passage count + 1 (original query).
        Returns list of ranked document ID lists.
        """
        # Original query is always index 0
        all_texts = [original_query] + [p for p in passages]

        tasks = [self.query_single_async(t, n_results=n_results) for t in all_texts]
        ranked_lists = await asyncio.gather(*tasks)

        return list(ranked_lists)
