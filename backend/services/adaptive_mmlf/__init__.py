"""
Adaptive MMLF (Multi-query Multi-passage Late Fusion) Service Package
Based on Kuo et al., NAACL 2025 with dynamic query complexity scaling,
parallel CQE generation, concurrent retrieval, in-memory caching, and resource adaptation.
"""

from .query_analyzer import QueryAnalyzer
from .cache_manager import CacheManager
from .resource_monitor import ResourceMonitor
from .subquery_generator import SubqueryGenerator
from .passage_expander import PassageExpander
from .retriever import AdaptiveRetriever
from .rrf_fusion import RRFFusion
from .adaptive_mmlf import AdaptiveMMLF

__all__ = [
    "AdaptiveMMLF",
    "QueryAnalyzer",
    "CacheManager",
    "ResourceMonitor",
    "SubqueryGenerator",
    "PassageExpander",
    "AdaptiveRetriever",
    "RRFFusion"
]
