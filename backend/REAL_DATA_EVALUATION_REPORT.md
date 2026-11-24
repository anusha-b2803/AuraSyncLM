# 📊 Preliminary Empirical Evaluation Report

> **Evaluation Mode:** Retrieval-Only (Deterministic Multi-Aspect Heuristics)  
> **Status:** Preliminary Measured Experiment (All mock/simulated numbers retracted)  
> **Evaluation Date:** 2026-10-20  
> **Test Corpus:** 110 passages extracted from `2025.findings-naacl.367.pdf` (*Kuo et al., NAACL 2025*)  
> **Embedding Model:** `all-MiniLM-L6-v2` (Dense Cosine Similarity)  
> **Vector Database:** ChromaDB HNSW Index (4.065s one-time index build time, isolated from queries)  
> **Statistical Convention:** Multi-trial repeated runs (3 trials $\times$ 4 queries = 12 query executions per system). Reported as sample mean $\pm$ sample standard deviation ($s$, with $N-1$ degrees of freedom). Raw per-query per-trial logs preserved in `raw_evaluation_results.json`.  

---

## 1. Comparative Results: All Three Architectures

| Architecture | Recall@5 | Recall@10 (mean ± std) | nDCG@10 | MRR@10 | Total Latency (mean ± std) | Vector Search Time | LLM Generation Time | Total LLM Calls |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline (Standard RAG)** | 0.5833 | 0.6667 ± 0.426 | 0.6591 | 0.7500 | 0.023s ± 0.033s | 0.023s | 0.000s | 0.0 |
| **Fixed MMLF (NAACL 2025)** | 0.4583 | 0.5833 ± 0.452 | 0.5083 | 0.6250 | 0.046s ± 0.013s | 0.046s | 0.000s | 0.0 |
| **Ada-MMLF (Adaptive)** | **0.4583** | **0.6667 ± 0.426** | **0.5098** | **0.6250** | **0.037s ± 0.017s** | **0.037s** | **0.000s** | **0.0** |

---

## 2. Per-Query Breakdown (Both Recall@5 and Recall@10 Included)

| Query ID | Category | Ground Truth Chunks | Baseline R@5 / R@10 | Fixed MMLF R@5 / R@10 | Ada-MMLF R@5 / R@10 | Mean Baseline Latency | Mean Ada-MMLF Latency |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **RQ1** | Direct Factual / Equation Constant | `chunk_71, chunk_72` | 1.000 / 1.000 | 0.500 / 1.000 | 0.500 / 1.000 | 0.050s | 0.029s |
| **RQ2** | Methodological Mechanism | `chunk_70, chunk_71, chunk_72` | 0.333 / 0.667 | 0.333 / 0.333 | 0.333 / 0.667 | 0.013s | 0.026s |
| **RQ3** | Comparative Multi-Aspect Synthesis | `chunk_68, chunk_84, chunk_85` | 0.000 / 0.000 | 0.000 / 0.000 | 0.000 / 0.000 | 0.016s | 0.065s |
| **RQ4** | Limitations / Efficiency | `chunk_46` | 1.000 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 | 0.013s | 0.029s |

---

## 3. Raw Scores Across Repeated Trials

Below are the exact per-trial measurements for independent verification:

| Trial | Query | Architecture | Hits@5 / Hits@10 | Denominator (|GT|) | Recall@5 | Recall@10 | nDCG@10 | MRR@10 | Latency |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.127s |
| 1 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.086s |
| 1 | RQ1 | Ada MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.030s |
| 1 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.012s |
| 1 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.039s |
| 1 | RQ2 | Ada MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.030s |
| 1 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.013s |
| 1 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.039s |
| 1 | RQ3 | Ada MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.062s |
| 1 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.012s |
| 1 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.044s |
| 1 | RQ4 | Ada MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.026s |
| 2 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.011s |
| 2 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.037s |
| 2 | RQ1 | Ada MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.029s |
| 2 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.014s |
| 2 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.050s |
| 2 | RQ2 | Ada MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.021s |
| 2 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.011s |
| 2 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.036s |
| 2 | RQ3 | Ada MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.063s |
| 2 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.015s |
| 2 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.039s |
| 2 | RQ4 | Ada MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.033s |
| 3 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.013s |
| 3 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.043s |
| 3 | RQ1 | Ada MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.029s |
| 3 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.014s |
| 3 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.047s |
| 3 | RQ2 | Ada MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.027s |
| 3 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.025s |
| 3 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.049s |
| 3 | RQ3 | Ada MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.071s |
| 3 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.012s |
| 3 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.041s |
| 3 | RQ4 | Ada MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.027s |

---

## 4. Ground Truth Verification Details

Every query's ground truth was manually verified by inspecting the chunk passages:
1. **RQ1** (*RRF Constant $k=60$*): Bound strictly to chunks `chunk_71` and `chunk_72` (Appendix A.2, p. 6608 formula).
2. **RQ2** (*Rank-based fusion vs score calibration*): Bound strictly to chunks `chunk_70`, `chunk_71`, `chunk_72` (Section 2.3 & Appendix A.2).
3. **RQ3** (*MILL Concatenation vs Late Fusion*): Bound strictly to chunks `chunk_68`, `chunk_84`, `chunk_85` (Early-fusion `[SEP]` concatenation vs late fusion RRF).
4. **RQ4** (*Computational Limitations*): Bound strictly to chunk `chunk_46` (Section 5, p. 6606 discussion on inference latency and retrieval workload).

---

## 5. Scientific Findings & Honest Limitations

1. **Ranking Quality Comparison:** On this 110-passage corpus, Standard Baseline RAG achieved higher nDCG@10 (0.6591) and MRR@10 (0.7500) than both Fixed MMLF (0.5083, 0.6250) and Ada-MMLF (0.5098, 0.6250).
2. **Query Drift in Fixed MMLF:** On focused queries (such as RQ2), generating static $n=3$ sub-queries introduced query drift, diluting top ranks and causing Fixed MMLF Recall@10 to fall to 0.5833 compared to Baseline 0.6667.
3. **Adaptive Trade-off:** Ada-MMLF successfully avoided this recall penalty, matching Baseline Recall@10 (0.6667) by skipping expansion on high-confidence queries, but its top-rank ordering (nDCG@10 = 0.5098) remains below baseline.
4. **Failure on Compound Comparative Query (RQ3):** All three architectures scored 0.000 on RQ3, proving that single-vector dense retrieval struggles to identify cross-section ablation comparisons without multi-hop re-ranking or explicit passage aggregation.
5. **Corpus Scope Limitation:** These observations are based on 110 passages from a single research paper (`2025.findings-naacl.367.pdf`). They are preliminary sanity checks and cannot be generalized across multi-domain RAG systems without larger benchmark evaluation (e.g., BEIR / HotpotQA).
