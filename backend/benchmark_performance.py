"""
AuraSync LM & MMLF Performance Benchmark Suite
================================================
Empirical evaluation benchmarking:
1. Baseline: Raw Single-Query Dense Retrieval (Standard RAG)
2. Fixed MMLF: Kuo et al., NAACL 2025 (Fixed n=3 Multi-Query + CQE + RRF)
3. Ada-MMLF: Hybrid B+C Adaptive Scaling

All evaluations run against real document passages and real vector search.
Simulated top scores, mock document pools, and artificial latencies have been completely removed.
"""

import os
import sys
import time
import argparse
import numpy as np
from typing import List, Set, Dict, Any, Tuple, Optional

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from eval_real_data import (
    compute_recall_at_k as recall_at_k,
    compute_ndcg_at_k as ndcg_at_k,
    compute_mrr_at_k as mrr_at_k,
    extract_and_chunk_pdf,
    build_real_chroma_index,
    run_real_evaluation
)


def run_evaluation_suite(
    pdf_path: Optional[str] = None,
    output_report: Optional[str] = None,
    top_k: int = 10,
    skip_llm: bool = False
) -> Dict[str, Any]:
    """
    Executes the comprehensive benchmark suite on real indexed document passages.
    Measures genuine wall-clock time and actual retrieval rankings without synthetic scoring.
    """
    print("\n" + "=" * 78)
    print("🚀 AuraSync LM Real Empirical Benchmark Suite: Baseline vs Fixed MMLF vs Ada-MMLF")
    print("=" * 78)
    print("(*) Running with real document retrieval and live latency measurements.")
    print("(*) All mock candidate pools and simulated score overrides are disabled.\n")

    return run_real_evaluation(
        pdf_path=pdf_path,
        output_report=output_report,
        top_k=top_k,
        skip_llm=skip_llm
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AuraSync LM Empirical Performance Benchmark")
    parser.add_argument("--pdf", type=str, default=None, help="Path to PDF document to index and evaluate")
    parser.add_argument("--report", type=str, default=None, help="Path to output markdown report")
    parser.add_argument("--top-k", type=int, default=10, help="Top-K cutoff for retrieval evaluation (default: 10)")
    parser.add_argument("--skip-llm", action="store_true", help="Skip live LLM generation for rapid testing")
    args = parser.parse_args()

    run_evaluation_suite(
        pdf_path=args.pdf,
        output_report=args.report,
        top_k=args.top_k,
        skip_llm=args.skip_llm
    )
