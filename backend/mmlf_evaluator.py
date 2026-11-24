"""
MMLF Evaluator: Real Data Empirical Benchmark Suite
===================================================
Evaluates Single-Query Baseline vs NAACL 2025 MMLF Pipeline vs Ada-MMLF.
Evaluates against real document passages and dense vector retrieval.
Metrics: Recall@10, nDCG@10, MRR@10 (identical to Kuo et al., NAACL 2025 Table 1).
"""

import sys
import os
import argparse
import numpy as np
from typing import List, Set, Dict, Any, Optional

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from eval_real_data import (
    compute_recall_at_k as recall_at_k,
    compute_ndcg_at_k as ndcg_at_k,
    compute_mrr_at_k as mrr_at_k,
    run_real_evaluation
)


def evaluate_real_study_corpus(
    pdf_path: Optional[str] = None,
    output_report: Optional[str] = None,
    top_k: int = 10,
    skip_llm: bool = False
) -> Dict[str, Any]:
    """
    Evaluates retrieval architectures on a real academic study corpus
    (e.g., the NAACL 2025 MMLF Paper or user study notes) using real embeddings
    and vector similarity.
    Replaces the legacy mock evaluation that relied on invented IDs and synthetic rankings.
    """
    print("\n" + "=" * 65)
    print("[*] AuraSync LM: NAACL 2025 MMLF Real-Data Benchmark Evaluation")
    print("=" * 65)

    return run_real_evaluation(
        pdf_path=pdf_path,
        output_report=output_report,
        top_k=top_k,
        skip_llm=skip_llm
    )


def evaluate_mock_study_corpus():
    """
    [DEPRECATED] Legacy mock evaluator with invented IDs has been decommissioned.
    Automatically redirects to evaluate_real_study_corpus() to use real document data.
    """
    import warnings
    warnings.warn(
        "evaluate_mock_study_corpus() is deprecated because it uses simulated scores and invented IDs. "
        "Redirecting to evaluate_real_study_corpus().",
        DeprecationWarning,
        stacklevel=2
    )
    return evaluate_real_study_corpus()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MMLF Evaluator: Real-Data Benchmark Suite")
    parser.add_argument("--pdf", type=str, default=None, help="Path to academic study document (PDF)")
    parser.add_argument("--report", type=str, default=None, help="Output markdown report path")
    parser.add_argument("--top-k", type=int, default=10, help="Retrieval cutoff K (default: 10)")
    parser.add_argument("--skip-llm", action="store_true", help="Skip live LLM generation for retrieval-only test")
    args = parser.parse_args()

    evaluate_real_study_corpus(
        pdf_path=args.pdf,
        output_report=args.report,
        top_k=args.top_k,
        skip_llm=args.skip_llm
    )
