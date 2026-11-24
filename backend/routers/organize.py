"""
routers/organize.py
────────────────────
File scanning, organization jobs, drive detection, and structured library browsing.
"""

import os
import json
import uuid
import logging
import threading
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks

from main import organize_files, DATA_DIR, get_all_drives, get_user_paths
from chatbot import clear_cache

logger = logging.getLogger(__name__)

router = APIRouter(tags=["File Organization"])

# In-memory background job tracking
_jobs = {}
_jobs_lock = threading.Lock()


def update_job(job_id: str, updates: dict):
    with _jobs_lock:
        if job_id in _jobs:
            _jobs[job_id].update(updates)


def _run_organize(job_id: str, paths: list, user_id: str, force: bool = False):
    try:
        with _jobs_lock:
            _jobs[job_id] = {
                "status": "running",
                "message": "Scanning files on drive...",
                "progress": 0,
                "total": 0,
                "result": None
            }
        result = organize_files(
            paths,
            user_id=user_id,
            force=force,
            progress_callback=lambda msg, done, total: update_job(
                job_id, {"message": msg, "progress": done, "total": total}
            )
        )
        with _jobs_lock:
            if result.get("status") == "success":
                clear_cache(user_id)
                _jobs[job_id].update({
                    "status": "done",
                    "message": "Organization complete!",
                    "result": result
                })
            else:
                _jobs[job_id].update({
                    "status": "error",
                    "message": result.get("message", "Unknown error")
                })
    except Exception as e:
        logger.error(f"Organization job {job_id} encountered an error: {e}")
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id].update({"status": "error", "message": str(e)})


class ScanRequest(BaseModel):
    paths: List[str]
    force: Optional[bool] = False
    userId: str = "default"


@router.get("/drives")
async def get_drives():
    """Detects and returns all available local drives."""
    drives = get_all_drives()
    return {"drives": drives}


@router.post("/organize")
async def trigger_organization(request: ScanRequest, background_tasks: BackgroundTasks):
    """Triggers an asynchronous scan and organization pipeline across specified drives."""
    paths = request.paths if request.paths else get_all_drives()
    logger.info(f"Triggering organization for user {request.userId} on paths: {paths}")
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {
            "status": "queued",
            "message": "Starting drive scan...",
            "progress": 0,
            "total": 0,
            "result": None
        }
    thread = threading.Thread(
        target=_run_organize,
        args=(job_id, paths, request.userId, request.force),
        daemon=True
    )
    thread.start()
    return {"job_id": job_id, "status": "queued", "drives": paths}


@router.get("/organize/status/{job_id}")
async def organize_status(job_id: str):
    """Polls progress status for an ongoing file organization job."""
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job:
            job = job.copy()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/files")
async def list_files(userId: str = "default"):
    """Returns the organized JSON structure directly from structure.json."""
    user_paths = get_user_paths(userId)
    structure_path = user_paths["structure_path"]

    if os.path.exists(structure_path):
        try:
            with open(structure_path, "r", encoding="utf-8") as f:
                structure = json.load(f)
            return {"structure": structure}
        except Exception as e:
            logger.error(f"Error reading structure.json: {e}")

    # Fallback if structure.json doesn't exist
    return {"structure": []}
