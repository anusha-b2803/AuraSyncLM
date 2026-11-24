# 📊 Comprehensive Empirical Evaluation Report: Multi-Query Multi-Passage Late Fusion (MMLF)

> **Document Type:** Master Benchmark & Reviewer Audit Response  
> **Evaluation Date:** 2026-10-20  
> **Test Corpus:** 110 passages extracted from `2025.findings-naacl.367.pdf` (*Kuo et al., NAACL 2025*)  
> **Dense Retriever:** `all-MiniLM-L6-v2` (Dense Cosine Similarity via PyTorch / HuggingFace)  
> **Vector Database:** ChromaDB HNSW Index (isolated from per-query latencies)  
> **Active Generative Model:** Ollama `llama3.2:latest` (3.2B parameters)  
> **Raw Datasets:** [`raw_retrieval_only_results.json`](file:///a:/new_p/aurasync/backend/raw_retrieval_only_results.json) & [`raw_live_llm_results.json`](file:///a:/new_p/aurasync/backend/raw_live_llm_results.json)  
> **Evaluation Script:** [`eval_real_data.py`](file:///a:/new_p/aurasync/backend/eval_real_data.py)  

---

## Executive Summary: Resolution of Reviewer Issues

| Reviewer Critique | Root Cause Identified | Correction Implemented & Documented |
| :--- | :--- | :--- |
| **1. LLM-Call Counts Contradict Pipeline** (0 calls reported despite Ollama generation) | Prior benchmark tested retrieval mechanics with deterministic heuristic subqueries, but did not explicitly label itself as retrieval-only. | Maintained **two strictly separated evaluations**: (A) **Retrieval-Only Benchmark** (0 calls, 0.000s LLM latency, deterministic multi-aspect expansion) and (B) **Live End-to-End LLM Benchmark** (active Ollama calls, timed generation latency vs vector lookup). |
| **2. Inconsistent Latency Columns** (Vector search time 0.101s exceeded total latency 0.061s) | Vector search time was previously estimated via an analytical multiplier ($t_{\text{base}} \times 4 = 0.025 \times 4 = 0.101\text{s}$), whereas actual wall-clock execution finished in $0.061\text{s}$ via concurrent threadpool lookups. | Replaced all synthetic multipliers with **monotonic `time.perf_counter()` wall-clock timestamps**. Total latency is mathematically guaranteed to equal: $\text{Retrieval Latency} + \text{LLM Latency} + \text{RRF Fusion Overhead}$. |
| **3. Standard Deviation Reproducibility** (0.408 std reported for Recall@10) | $\sigma = 0.408$ corresponds to **population standard deviation** with $N=4$ ($\text{ddof}=0$). Sample standard deviation with Bessel's correction ($N-1=3$, $\text{ddof}=1$) is $s = 0.471$, and over all 12 trial observations ($N-1=11$) is $s = 0.426$. | **Documented the exact mathematical derivation** for all standard deviation conventions in Section 1.3 and provided raw per-trial scores for independent verification. |
| **4. Recall@5 and Recall@10 Granularity** (Aggregate reported R@5, but breakdown omitted it) | Per-query breakdown previously omitted Recall@5 and did not display the relevance denominator $|GT|$. | Added **per-query Recall@5 and Recall@10 side-by-side**, with explicit ground-truth denominators ($|GT| = 1, 2, \text{or } 3$) and hit counts ($Hits@5 / Hits@10$). |

---

## 1. Benchmark A: Retrieval-Only Evaluation

> **Evaluation Mode:** Retrieval-Only (Deterministic Multi-Aspect Heuristics)  
> **Methodology:** Isolates vector search efficiency and Reciprocal Rank Fusion (RRF, $k=60$) quality. Model generation is deliberately bypassed (0 LLM calls, 0.000s generation time) using deterministic heuristic sub-queries to evaluate ranking behavior without stochastic LLM variation.  
> **Repeated Trials:** 3 trials $\times$ 4 queries = 12 query evaluations per architecture.  

### 1.1 Aggregate Performance Metrics

| Architecture | Recall@5 | Recall@10 (mean ± sample $s$) | nDCG@10 | MRR@10 | Total Latency (mean ± sample $s$) | Vector Search Time | LLM Generation Time | Total LLM Calls |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline (Standard RAG)** | 0.5833 | 0.6667 ± 0.426 | **0.6591** | **0.7500** | **0.023s ± 0.033s** | 0.023s | 0.000s | 0.0 |
| **Fixed MMLF (NAACL 2025)** | 0.4583 | 0.5833 ± 0.452 | 0.5083 | 0.6250 | 0.046s ± 0.013s | 0.046s | 0.000s | 0.0 |
| **Ada-MMLF (Adaptive)** | 0.4583 | **0.6667 ± 0.426** | 0.5098 | 0.6250 | 0.037s ± 0.017s | 0.037s | 0.000s | 0.0 |

*Note: Latency is reported as sample mean $\pm$ sample standard deviation ($s$, $\text{ddof}=1$). All times are wall-clock measured.*

---

### 1.2 Per-Query Breakdown (Both Recall@5 and Recall@10)

| Query ID | Category | Ground Truth Chunks | Denominator ($|GT|$) | Baseline R@5 / R@10 | Fixed MMLF R@5 / R@10 | Ada-MMLF R@5 / R@10 | Baseline Latency | Ada-MMLF Latency |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **RQ1** | Direct Factual / Constant | `chunk_71, chunk_72` | 2 | 1.000 / 1.000 | 0.500 / 1.000 | 0.500 / 1.000 | 0.050s | 0.029s |
| **RQ2** | Methodological Mechanism | `chunk_70, chunk_71, chunk_72` | 3 | 0.333 / 0.667 | 0.333 / 0.333 | 0.333 / 0.667 | 0.013s | 0.026s |
| **RQ3** | Comparative Synthesis | `chunk_68, chunk_84, chunk_85` | 3 | 0.000 / 0.000 | 0.000 / 0.000 | 0.000 / 0.000 | 0.016s | 0.065s |
| **RQ4** | Limitations / Workload | `chunk_46` | 1 | 1.000 / 1.000 | 1.000 / 1.000 | 1.000 / 1.000 | 0.013s | 0.029s |

---

### 1.3 Mathematical Derivation & Proof of Standard Deviations

For Baseline Recall@10, the per-query values are:
$$\mathbf{r} = [1.000, 0.6667, 0.000, 1.000]$$
The sample mean is:
$$\bar{r} = \frac{1.0 + 2/3 + 0.0 + 1.0}{4} = \frac{8/3}{4} = \frac{2}{3} \approx \mathbf{0.6667}$$

The sum of squared deviations from the mean across the 4 query categories is:
$$\sum_{i=1}^4 (r_i - \bar{r})^2 = (1/3)^2 + (0)^2 + (-2/3)^2 + (1/3)^2 = \frac{1 + 0 + 4 + 1}{9} = \frac{6}{9} = \frac{2}{3} \approx 0.6667$$

1. **Population Standard Deviation across 4 Queries ($\sigma$, $\text{ddof}=0$):**
   $$\sigma = \sqrt{\frac{2/3}{4}} = \sqrt{\frac{1}{6}} \approx \mathbf{0.4082}$$
   *(This proves where the earlier report's 0.408 originated).*
2. **Sample Standard Deviation across 4 Queries ($s$, $\text{ddof}=1$):**
   $$s = \sqrt{\frac{2/3}{4 - 1}} = \sqrt{\frac{2}{9}} = \frac{\sqrt{2}}{3} \approx \mathbf{0.4714}$$
3. **Sample Standard Deviation across all 12 Observations ($s_{12}$, $\text{ddof}=1$):**
   Since the deterministic retrieval index produces identical ranks across repeated trials, the 12 observations consist of 3 identical repetitions of $\mathbf{r}$. Sum of squared deviations = $3 \times (2/3) = 2.0$:
   $$s_{12} = \sqrt{\frac{2.0}{12 - 1}} = \sqrt{\frac{2}{11}} \approx \mathbf{0.4264}$$
   *(This is the $\pm 0.426$ reported in the revised aggregate table).*

---

### 1.4 Raw Scores Across All 3 Trials (36 Recorded Evaluations)

| Trial | Query | Architecture | Hits@5 / Hits@10 | Denominator ($|GT|$) | Recall@5 | Recall@10 | nDCG@10 | MRR@10 | Wall-Clock Latency |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.127s |
| 1 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.086s |
| 1 | RQ1 | Ada-MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.030s |
| 1 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.012s |
| 1 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.039s |
| 1 | RQ2 | Ada-MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.030s |
| 1 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.013s |
| 1 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.039s |
| 1 | RQ3 | Ada-MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.062s |
| 1 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.012s |
| 1 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.044s |
| 1 | RQ4 | Ada-MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.026s |
| 2 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.011s |
| 2 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.037s |
| 2 | RQ1 | Ada-MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.029s |
| 2 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.014s |
| 2 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.050s |
| 2 | RQ2 | Ada-MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.021s |
| 2 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.011s |
| 2 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.036s |
| 2 | RQ3 | Ada-MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.063s |
| 2 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.015s |
| 2 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.039s |
| 2 | RQ4 | Ada-MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.033s |
| 3 | RQ1 | Baseline | 2/2 | 2 | 1.000 | 1.000 | 1.000 | 1.000 | 0.013s |
| 3 | RQ1 | Fixed MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.564 | 0.500 | 0.043s |
| 3 | RQ1 | Ada-MMLF | 1/2 | 2 | 0.500 | 1.000 | 0.798 | 1.000 | 0.029s |
| 3 | RQ2 | Baseline | 1/2 | 3 | 0.333 | 0.667 | 0.636 | 1.000 | 0.014s |
| 3 | RQ2 | Fixed MMLF | 1/1 | 3 | 0.333 | 0.333 | 0.469 | 1.000 | 0.047s |
| 3 | RQ2 | Ada-MMLF | 1/2 | 3 | 0.333 | 0.667 | 0.611 | 1.000 | 0.027s |
| 3 | RQ3 | Baseline | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.025s |
| 3 | RQ3 | Fixed MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.049s |
| 3 | RQ3 | Ada-MMLF | 0/0 | 3 | 0.000 | 0.000 | 0.000 | 0.000 | 0.071s |
| 3 | RQ4 | Baseline | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.012s |
| 3 | RQ4 | Fixed MMLF | 1/1 | 1 | 1.000 | 1.000 | 1.000 | 1.000 | 0.041s |
| 3 | RQ4 | Ada-MMLF | 1/1 | 1 | 1.000 | 1.000 | 0.631 | 0.500 | 0.027s |

---

## 2. Benchmark B: Live End-to-End LLM Benchmark

> **Evaluation Mode:** Live End-to-End LLM Generation  
> **Generator Model:** Ollama `llama3.2:latest` (3.2B parameters, local server)  
> **Methodology:** Executes actual LLM generation for Multi-Query Generation (MQR) and Combined Query Expansion (CQE parallel pseudo-passages), followed by vector retrieval and RRF fusion.  
> **Cache Audit:** Fixed MMLF executed cold-start invocations across all queries. Ada-MMLF evaluates adaptive routing: skipping calls on high-confidence queries vs triggering dynamic expansions.  

### 2.1 Live LLM Comparison

| Architecture | Recall@5 | Recall@10 | nDCG@10 | MRR@10 | Total Wall-Clock Latency | Vector Search Time | LLM Generation Time | Actual LLM Calls / Query |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Baseline (Standard RAG)** | 0.5833 | 0.6667 | **0.6591** | **0.7500** | **0.055s ± 0.032s** | 0.055s | 0.000s | 0.0 |
| **Fixed MMLF (NAACL 2025)** | **0.6667** | 0.6667 | 0.5463 | 0.5833 | 22.330s ± 5.726s | 0.368s | 21.962s | 4.0 |
| **Ada-MMLF (Cold Routing)** | **0.6667** | 0.6667 | 0.5463 | 0.5833 | 11.240s ± 9.450s | 0.285s | 10.955s | 1.75 |
| **Ada-MMLF (Warm Cache)** | **0.6667** | 0.6667 | 0.5463 | 0.5833 | 0.399s ± 0.258s | 0.353s | 0.046s | 3.8 (0 network) |

### 2.2 Cold vs Warm Dissection for Ada-MMLF

1. **Fixed MMLF Cost:** Unconditionally dispatches 1 MQR prompt + 3 CQE prompts = **4.0 LLM calls per query**, consuming an average of **21.962 seconds** of generation time per query.
2. **Ada-MMLF Cold Behavior:**
   - **RQ1 & RQ4 (High Confidence):** Deterministic confidence router detects sharp semantic separation ($>0.70$) and fast-tracks the query ($n=0$). **Zero LLM calls dispatched**, latency drops to pure vector lookup (~0.05s).
   - **RQ2 & RQ3 (Ambiguous / Complex):** Adaptive router triggers expansion ($n=2$ or $3$). Total LLM calls average **1.75 calls per query** (a **56.2% reduction in generative workload** compared to Fixed MMLF).
3. **Warm Cache Behavior:** When semantic caching is enabled, repeated or semantically similar sub-queries hit the cache in ~0.046s, eliminating redundant Ollama inferences.

---

## 3. Audited Ground-Truth Mappings & Failure Analysis

Every query's ground truth was verified against specific sections of `2025.findings-naacl.367.pdf`:

| Query ID | Ground Truth Chunks | Document Section & Verified Content | Root Cause for Retrieval Failure / Drift |
| :--- | :--- | :--- | :--- |
| **RQ1** | `chunk_71, chunk_72` | **Appendix A.2 (p. 6608):** Explicit formula $RRF(d) = \sum \frac{1}{k + r_i(d)}$ with constant $k=60$. | High lexical overlap; both Baseline and Ada-MMLF hit 100% Recall@10. |
| **RQ2** | `chunk_70, chunk_71, chunk_72` | **Section 2.3 & Appendix A.2:** Rank-based late fusion avoiding score calibration and normalization issues across different sub-queries. | **Query Drift in Fixed MMLF:** Static $n=3$ subqueries introduced tangentially related ranking text, pushing `chunk_71` past rank 10 in Fixed MMLF (dropping Recall@10 from 0.667 to 0.333). Ada-MMLF avoided this drift. |
| **RQ3** | `chunk_68, chunk_84, chunk_85` | **Section 1 & Appendix B.4:** MILL early fusion with `[SEP]` concatenation vs Late Fusion RRF. | **Zero Recall Across All Systems (0.000):** This complex comparative query requires cross-section multi-hop synthesis. 500-character single-vector embeddings fail to match disjoint comparison paragraphs without multi-hop reasoning. |
| **RQ4** | `chunk_46` | **Section 5 (p. 6606):** Discussion on computational overhead, latency, and throughput limitations. | Baseline, Fixed MMLF, and Ada-MMLF all achieve 100% Recall@5 and Recall@10. |

---

## 4. Objective Scientific Interpretation & Corpus Scope Limitations

1. **Ada-MMLF vs Baseline Trade-Off:**
   - On this 110-passage corpus, Ada-MMLF matches Baseline Recall@10 (**0.6667**), successfully avoiding the query drift that penalized Fixed MMLF (**0.5833**).
   - However, **Baseline RAG maintains higher top-rank precision**: Baseline nDCG@10 is **0.6591** (vs Ada-MMLF **0.5098**) and Baseline MRR@10 is **0.7500** (vs Ada-MMLF **0.6250**).
   - *Scientific Conclusion:* For single-document corpora with concise factual queries, dense single-query retrieval already ranks the primary passage at rank 1. Multi-aspect fusion broadens passage discovery but introduces minor ranking dilution at the very top rank ($K=1$).
2. **Fixed MMLF Vulnerability:**
   - Unconditionally generating 3 sub-queries and 3 pseudo-passages hurts precision on focused queries. Fixed MMLF had the lowest Recall@10 (0.5833) in the retrieval-only evaluation.
3. **Compound Comparative Queries (RQ3 Gap):**
   - Scoring 0.000 across Baseline, Fixed MMLF, and Ada-MMLF on RQ3 reveals a fundamental limitation of standard dense bi-encoders on comparative synthesis questions. Addressing this requires iterative multi-hop retrieval or explicit cross-passage graph aggregation.
4. **Corpus Scope Limitation:**
   - **These observations are preliminary sanity checks on 110 passages from a single research paper.** They do not constitute evidence of generalized superiority across multi-domain enterprise RAG systems. Validating broader claims requires testing on standard multi-hop benchmarks (e.g., BEIR, HotpotQA, MultiHop-RAG).

---

## 5. Code Audit & Reproducibility Reference

All metrics, data points, and logs can be independently inspected and executed via:

- **Metric Formulations:** [`eval_real_data.py:L57-L94`](file:///a:/new_p/aurasync/backend/eval_real_data.py#L57-L94)
  - `compute_recall_at_k(retrieved_ids, ground_truth_ids, k)`
  - `compute_ndcg_at_k(retrieved_ids, ground_truth_ids, k)`
  - `compute_mrr_at_k(retrieved_ids, ground_truth_ids, k)`
- **Timing & Retriever Implementation:** [`eval_real_data.py:L230-L255`](file:///a:/new_p/aurasync/backend/eval_real_data.py#L230-L255)
  - Monotonic `time.perf_counter()` duration recording for vector lookups and LLM generation.
- **Raw Data Artifacts:**
  - Retrieval-Only 3-Trial Dataset: [`raw_retrieval_only_results.json`](file:///a:/new_p/aurasync/backend/raw_retrieval_only_results.json)
  - Live End-to-End LLM Dataset: [`raw_live_llm_results.json`](file:///a:/new_p/aurasync/backend/raw_live_llm_results.json)
