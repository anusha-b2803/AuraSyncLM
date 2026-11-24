"""
AuraSync LM - Local Core API Server
───────────────────────────────────
Decoupled FastAPI service layer mounting modular routers for authentication,
system management, file indexing, RAG chat completion, and adaptive MMLF search.
"""

import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import sys
import logging
import asyncio
import warnings
import argparse

# --- Suppress Noisy Warnings ---
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# --- Fix Windows asyncio 'ConnectionResetError' noise ---
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# --- Silence Logs ASAP ---
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("ollama").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

# --- CLI Arguments ---
parser = argparse.ArgumentParser(description="AuraSync LM Local API Server")
parser.add_argument("--port", type=int, default=8000, help="Port to run backend on")
parser.add_argument("--token", type=str, default="", help="Optional bearer token for API auth")
parser.add_argument("--no-app", action="store_true", help="Do not automatically launch desktop app window")
args, _ = parser.parse_known_args()

# --- Suppress TensorFlow ---
os.environ["TRANSFORMERS_NO_TENSORFLOW"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
sys.modules["tensorflow"] = None
sys.modules["tensorflow.data"] = None

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# --- Import Modular Routers ---
from routers.auth import router as auth_router
from routers.system import router as system_router
from routers.organize import router as organize_router
from routers.chat import router as chat_router
from routers.search import router as search_router

logger = logging.getLogger(__name__)

# --- Initialize FastAPI Application ---
app = FastAPI(
    title="AuraSync LM Local API",
    version="2.0.0",
    description="High-performance Local Intelligence Hub with NAACL 2025 MMLF and Ada-MMLF retrieval."
)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_token(request: Request, call_next):
    if args.token and request.method != "OPTIONS" and request.url.path != "/":
        auth = request.headers.get("Authorization")
        if not auth or auth != f"Bearer {args.token}":
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
    return await call_next(request)


# --- Root Endpoint ---
@app.get("/")
async def root():
    return {
        "service": "AuraSync LM Local API",
        "status": "online",
        "architecture": "modular-routers",
        "mmlf": "NAACL 2025 Late Fusion + Ada-MMLF",
        "version": "2.0.0"
    }


# --- Register Modular Routers ---
app.include_router(auth_router)
app.include_router(system_router)
app.include_router(organize_router)
app.include_router(chat_router)
app.include_router(search_router)


# --- Desktop App Launcher ---
def launch_desktop_app(port: int):
    """Launches the Electron desktop app window once backend is ready."""
    import time
    import urllib.request
    import subprocess

    time.sleep(1.0)
    for _ in range(25):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1):
                break
        except Exception:
            time.sleep(0.4)

    # Check if Electron is already open
    try:
        chk = subprocess.run('tasklist /FI "IMAGENAME eq electron.exe"', shell=True, capture_output=True, text=True)
        if "electron.exe" in chk.stdout.lower():
            logger.info("[Desktop App] Electron is already open. Skipping duplicate launch.")
            return
    except Exception:
        pass

    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    if os.path.exists(frontend_dir):
        logger.info("[Desktop App] Automatically launching AuraSync LM Desktop Application window...")
        try:
            subprocess.Popen(
                "npx electron .",
                cwd=frontend_dir,
                shell=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except Exception as e:
            logger.error(f"[Desktop App] Failed to launch Electron window: {e}")


if __name__ == "__main__":
    import threading
    import uvicorn

    if not args.no_app:
        threading.Thread(target=launch_desktop_app, args=(args.port,), daemon=True).start()

    uvicorn.run(app, host="127.0.0.1", port=args.port)
