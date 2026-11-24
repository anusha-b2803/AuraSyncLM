"""
routers/system.py
──────────────────
System health, hardware probing, Ollama lifecycle, and research library reset endpoints.
"""

import os
import json
import shutil
import logging
import requests
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from main import DATA_DIR, get_user_paths
from chatbot import get_ollama_status, clear_cache
from hardware_probe import probe_system_hardware, check_ollama_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["System"])


class ModelDownloadRequest(BaseModel):
    model: str = "llama3.2:latest"


@router.get("/health")
async def health_check(userId: Optional[str] = "default"):
    """
    Comprehensive system health check.
    Inspects Ollama connectivity, index readiness, and document organization status.
    """
    status = get_ollama_status()
    user_paths = get_user_paths(userId)

    # Check user-specific folder
    index_ready = os.path.exists(user_paths["chroma_dir"])
    files_organized = os.path.exists(user_paths["output_folder"]) and any(
        os.scandir(user_paths["output_folder"])
    ) if os.path.exists(user_paths["output_folder"]) else False

    # Fallback to global folder if user-specific is empty
    if not files_organized:
        global_output_folder = os.path.join(DATA_DIR, "organized_files")
        if os.path.exists(global_output_folder) and any(os.scandir(global_output_folder)):
            files_organized = True

    if not index_ready:
        global_chroma_path = os.path.join(DATA_DIR, "chroma_db")
        if os.path.exists(global_chroma_path):
            index_ready = True

    return {
        "status": "ok",
        "index_ready": index_ready,
        "files_organized": files_organized,
        "ollama": {
            "running": status["active"],
            "flaw": status.get("flaw"),
            "message": status["message"],
            "active": status["active"],
            "offline_mode_ready": True
        }
    }


@router.get("/system/hardware")
async def get_hardware_info():
    """Returns detected hardware and adaptive model recommendation."""
    return probe_system_hardware()


@router.get("/system/ollama/status")
async def get_ollama_status_api():
    """Returns Ollama daemon reachability and available models."""
    return check_ollama_service()


@router.post("/system/ollama/pull-stream")
async def pull_model_stream(req: ModelDownloadRequest):
    """Streams model pull progress via Ollama HTTP API."""
    def stream_pull():
        try:
            r = requests.post(
                "http://127.0.0.1:11434/api/pull",
                json={"name": req.model, "stream": True},
                stream=True,
                timeout=600
            )
            for line in r.iter_lines():
                if line:
                    yield line.decode("utf-8") + "\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(stream_pull(), media_type="application/x-ndjson")


@router.post("/system/download-model")
async def download_model(req: ModelDownloadRequest):
    """Initiates an Ollama model pull."""
    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')
        client.pull(req.model)
        return {"status": "success", "message": f"Successfully pulled {req.model}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull model: {e}")


@router.post("/system/reset")
async def system_reset(userId: str = "default"):
    """Wipes all organized data and the RAG index for a fresh start."""
    try:
        user_paths = get_user_paths(userId)
        if os.path.exists(user_paths["output_folder"]):
            shutil.rmtree(user_paths["output_folder"])
        if os.path.exists(user_paths["chroma_dir"]):
            shutil.rmtree(user_paths["chroma_dir"])
        if os.path.exists(user_paths["scan_cache_path"]):
            os.remove(user_paths["scan_cache_path"])
        if os.path.exists(user_paths["structure_path"]):
            os.remove(user_paths["structure_path"])

        clear_cache(userId)
        return {"status": "success", "message": f"Research library for {userId} purged successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
