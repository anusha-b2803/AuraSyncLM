"""
RRF Fusion: Stage 7 of Adaptive MMLF Pipeline
Implements Weighted Reciprocal Rank Fusion (RRF) with constant k=60.
Dynamically computes weights based on query complexity to balance
original query intent with exploratory pseudo-passage expansions.
"""

from typing import List, Dict, Any, Optional, Tuple


class RRFFusion:
    """
    Weighted Reciprocal Rank Fusion (RRF).
    Formula: score(d) = sum( weight_i * 1 / (k + rank_i + 1) )
    where rank is 0-indexed (rank 0 is top-ranked item).
    """

    def __init__(self, k: int = 60):
        self.k = int(k)

    @staticmethod
    def calculate_weights(complexity: float, passage_count: int) -> List[float]:
        """
        Calculates dynamic weights based on complexity:
        - complexity < 0.3      -> original query weight = 2.0
        - complexity 0.3 - 0.7  -> original query weight = 1.5
        - complexity > 0.7      -> original query weight = 1.0
        - Passage weights       -> 1.0 each (equal)
        Returns list of length: 1 + passage_count
        """
        if complexity < 0.3:
            query_weight = 2.0
        elif complexity <= 0.7:
            query_weight = 1.5
        else:
            query_weight = 1.0

        weights = [query_weight] + [1.0] * max(0, int(passage_count))
        return weights

    def fuse(
        self,
        ranked_lists: List[List[str]],
        weights: Optional[List[float]] = None,
        k: Optional[int] = None
    ) -> List[str]:
        """
        Combines multiple ranked lists of document IDs using weighted RRF.
        Returns sorted list of document IDs (highest scoring first).
        """
        if not ranked_lists:
            return []

        rrf_k = self.k if k is None else int(k)

        # Default equal weights if not provided
        if weights is None or len(weights) != len(ranked_lists):
            weights = [1.0] * len(ranked_lists)

        doc_scores: Dict[str, float] = {}
        first_seen_order: Dict[str, int] = {}
        order_counter = 0

        for list_idx, doc_list in enumerate(ranked_lists):
            weight = weights[list_idx]
            for rank, doc_id in enumerate(doc_list):
                if not doc_id:
                    continue
                doc_str = str(doc_id)
                if doc_str not in first_seen_order:
                    first_seen_order[doc_str] = order_counter
                    order_counter += 1

                # Formula: score += weight * (1 / (k + rank + 1))
                reciprocal_rank = 1.0 / (rrf_k + rank + 1)
                doc_scores[doc_str] = doc_scores.get(doc_str, 0.0) + (weight * reciprocal_rank)

        # Sort descending by score. In case of ties, use first_seen_order for consistency.
        sorted_docs = sorted(
            doc_scores.keys(),
            key=lambda d: (-doc_scores[d], first_seen_order[d])
        )

        return sorted_docs

    def fuse_with_scores(
        self,
        ranked_lists: List[List[str]],
        weights: Optional[List[float]] = None,
        k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Combines ranked lists and returns documents along with their accumulated RRF score and rank.
        """
        sorted_ids = self.fuse(ranked_lists, weights, k)
        rrf_k = self.k if k is None else int(k)
        if weights is None or len(weights) != len(ranked_lists):
            weights = [1.0] * len(ranked_lists)

        # Recalculate scores dictionary
        doc_scores: Dict[str, float] = {}
        for list_idx, doc_list in enumerate(ranked_lists):
            weight = weights[list_idx]
            for rank, doc_id in enumerate(doc_list):
                if not doc_id:
                    continue
                doc_str = str(doc_id)
                reciprocal_rank = 1.0 / (rrf_k + rank + 1)
                doc_scores[doc_str] = doc_scores.get(doc_str, 0.0) + (weight * reciprocal_rank)

        results = []
        for final_rank, doc_id in enumerate(sorted_ids):
            results.append({
                "id": doc_id,
                "score": round(doc_scores.get(doc_id, 0.0), 6),
                "rank": final_rank + 1
            })

        return results
