"""
routers/search.py
──────────────────
Adaptive Multi-Query Multi-Passage Late Fusion (Ada-MMLF) endpoints.
Supports synchronous search, Server-Sent Events (SSE) streaming, and real-time cache telemetry.
"""

import time
import json
import asyncio
import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from services.adaptive_mmlf import AdaptiveMMLF

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Adaptive Search"])

# Shared engine instance
adaptive_mmlf_engine = AdaptiveMMLF()


class AdaptiveSearchRequest(BaseModel):
    query: str
    mode: Optional[str] = None  # "fast", "smart", or auto/None
    top_k: Optional[int] = 10


@router.post("/api/search/adaptive")
async def api_search_adaptive(req: AdaptiveSearchRequest):
    """
    Executes Adaptive MMLF Search.
    Returns 200 on success, 500 on failure. Logs response time.
    """
    t0 = time.time()
    try:
        result = await adaptive_mmlf_engine.search(
            query=req.query,
            mode=req.mode,
            top_k=req.top_k or 10
        )
        duration_ms = round((time.time() - t0) * 1000, 2)
        result["response_time_ms"] = duration_ms
        logger.info(f"[/api/search/adaptive] query='{req.query}' mode={result.get('mode')} time={duration_ms}ms")
        return result
    except Exception as e:
        logger.error(f"[/api/search/adaptive] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/search/adaptive/stream")
async def api_search_adaptive_stream(query: str, mode: Optional[str] = None, top_k: int = 10):
    """
    SSE (Server-Sent Events) endpoint streaming progress events through the Adaptive MMLF stages:
    - Stage 1: analyzing
    - Stage 2: generating / expanding / retrieving
    - Stage 3: complete (with final results)
    Connection automatically closes after completion.
    """
    async def sse_event_stream():
        event_queue = asyncio.Queue()

        def progress_listener(stage: str, message: str, extra: Dict[str, Any]):
            event_queue.put_nowait({
                "stage": stage,
                "message": message,
                "data": extra
            })

        async def worker():
            try:
                res = await adaptive_mmlf_engine.search(
                    query=query,
                    mode=mode,
                    progress_callback=progress_listener,
                    top_k=top_k
                )
                await event_queue.put({
                    "stage": "complete",
                    "message": "Complete!",
                    "data": res
                })
            except Exception as e:
                await event_queue.put({
                    "stage": "error",
                    "message": str(e),
                    "data": {"error": str(e)}
                })
            finally:
                await event_queue.put(None)  # Sentinel to close stream

        worker_task = asyncio.create_task(worker())

        while True:
            evt = await event_queue.get()
            if evt is None:
                break
            yield f"data: {json.dumps(evt)}\n\n"

        await worker_task

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/api/search/cache/stats")
async def api_search_cache_stats():
    """
    Returns real-time cache statistics:
    - cached_queries: int
    - total_hits: int
    - cache_size_mb: float
    """
    return adaptive_mmlf_engine.cache_manager.get_stats()


@router.post("/api/search/cache/clear")
async def api_search_cache_clear():
    """Clears all cache entries and returns confirmation."""
    adaptive_mmlf_engine.cache_manager.clear()
    return {"status": "success", "message": "Adaptive MMLF cache cleared successfully."}
