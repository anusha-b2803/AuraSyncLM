"""
routers/chat.py
────────────────
RAG Chat endpoint with streaming token generation, MMLF stage events,
and resilient fallback when Ollama is offline or encounters connection failures.
"""

import os
import json
import asyncio
import logging
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from main import DATA_DIR, get_user_paths
from chatbot import retrieve, mmlf_retrieve, stream_answer, get_ollama_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Chat & Retrieval"])


class ChatRequest(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None
    history: Optional[List[dict]] = []
    userId: str = "default"
    retrievalMode: Optional[str] = "mmlf"  # "mmlf" (NAACL 2025 Neural Fusion) or "standard"


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Primary chat completion endpoint.
    Retrieves relevant passages using MMLF or standard dense retrieval,
    and streams tokens with resilient offline fallback if Ollama is unreachable.
    """
    try:
        query = request.query or request.question
        history = request.history or []
        user_id = request.userId

        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        user_paths = get_user_paths(user_id)
        index_exists = os.path.exists(user_paths["chroma_dir"])

        # Fallback check for global index
        if not index_exists:
            global_chroma_path = os.path.join(DATA_DIR, "chroma_db")
            if os.path.exists(global_chroma_path):
                index_exists = True

        if not index_exists:
            async def no_index_gen():
                yield json.dumps({"type": "metadata", "contexts": []}) + "\n"
                yield json.dumps({
                    "type": "token",
                    "token": "⚠️ Knowledge base not found for this user. Please go to **Library** and run a Full Sync first to index your documents."
                }) + "\n"
                yield json.dumps({"type": "done"}) + "\n"
            return StreamingResponse(no_index_gen(), media_type="application/x-ndjson")

        retrieval_mode = (request.retrievalMode or "mmlf").lower()
        ollama_status = get_ollama_status()
        is_offline = not ollama_status.get("active", False)

        # Stream AI answer token-by-token with progressive MMLF stage events
        async def generate_stream():
            try:
                contexts = []
                subqueries = []
                pseudo_docs = []

                if retrieval_mode == "mmlf":
                    yield json.dumps({
                        "type": "mmlf_status",
                        "stage": "start",
                        "message": "Initiating NAACL 2025 MMLF Pipeline..." if not is_offline else "Initiating MMLF Dense Pipeline (Offline Fallback)..."
                    }) + "\n"

                    loop = asyncio.get_running_loop()
                    status_queue = asyncio.Queue()

                    def progress_cb(stage, msg, data):
                        loop.call_soon_threadsafe(status_queue.put_nowait, (stage, msg, data))

                    def run_worker():
                        res = mmlf_retrieve(query, user_id=user_id, top_k=4, progress_callback=progress_cb)
                        loop.call_soon_threadsafe(status_queue.put_nowait, ("DONE", "", res))
                        return res

                    worker_task = loop.run_in_executor(None, run_worker)

                    mmlf_result = None
                    while True:
                        stage, msg, data = await status_queue.get()
                        if stage == "DONE":
                            mmlf_result = data
                            break
                        yield json.dumps({"type": "mmlf_status", "stage": stage, "message": msg, "data": data}) + "\n"

                    await worker_task
                    contexts = mmlf_result.get("contexts", []) if mmlf_result else []
                    subqueries = mmlf_result.get("subqueries", []) if mmlf_result else []
                    pseudo_docs = mmlf_result.get("pseudo_documents", []) if mmlf_result else []

                    # Send sources metadata with MMLF perspectives
                    yield json.dumps({
                        "type": "metadata",
                        "contexts": contexts,
                        "offline_fallback": is_offline,
                        "mmlf": {
                            "active": True,
                            "subqueries": subqueries,
                            "pseudo_documents": [p[:200] + "..." for p in pseudo_docs]
                        }
                    }) + "\n"
                else:
                    # Standard baseline single-query retrieval
                    contexts = retrieve(query, user_id=user_id, top_k=3)
                    yield json.dumps({
                        "type": "metadata",
                        "contexts": contexts,
                        "offline_fallback": is_offline,
                        "mmlf": {"active": False}
                    }) + "\n"

                # Stream answer tokens (handles Ollama or resilient offline extractive mode)
                async for token in stream_answer(query, contexts, history):
                    yield json.dumps({"type": "token", "token": token}) + "\n"

                yield json.dumps({"type": "done"}) + "\n"
            except Exception as stream_err:
                logger.error(f"Stream generation error: {stream_err}")
                yield json.dumps({
                    "type": "token",
                    "token": f"\n\n[Generation Notice: {str(stream_err)}]"
                }) + "\n"
                yield json.dumps({"type": "done"}) + "\n"

        return StreamingResponse(generate_stream(), media_type="application/x-ndjson")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
