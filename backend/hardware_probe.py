"""
Hardware Prober & Adaptive Model Provisioner for AuraSync LM
Detects system resources (RAM, VRAM, GPU, CPU) and selects the optimal
local model profile for zero-configuration student desktop deployment.
"""

import os
import sys
import json
import logging
import subprocess
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def probe_system_hardware() -> Dict[str, Any]:
    """
    Probes system RAM, CPU, and GPU capabilities.
    Returns hardware specs and recommended model profile.
    """
    # 1. Probe RAM
    ram_gb = 8.0  # default assumption
    try:
        import psutil
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
    except Exception:
        try:
            # Windows fallback
            if sys.platform == 'win32':
                cmd = "powershell -Command \"(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB\""
                out = subprocess.check_output(cmd, shell=True, text=True).strip()
                ram_gb = float(out)
        except Exception as e:
            logger.warning(f"RAM probe fallback: {e}")

    # 2. Probe GPU & VRAM
    gpu_name = "Integrated / CPU"
    vram_gb = 0.0
    has_nvidia = False

    try:
        smi = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
        if smi:
            parts = smi.split("\n")[0].split(",")
            gpu_name = parts[0].strip()
            vram_gb = float(parts[1].strip()) / 1024.0
            has_nvidia = True
    except Exception:
        pass

    # 3. Dynamic Model Profile Selection
    # High-end: 8GB+ VRAM or 28GB+ RAM -> Llama 3.1 8B
    # Mid-tier: 4GB+ VRAM or 14GB+ RAM -> Llama 3.2 3B
    # Lightweight: <= 8GB RAM / CPU-only -> Llama 3.2 1B or Qwen 2.5 1.5B
    if vram_gb >= 7.5 or ram_gb >= 28.0:
        recommended_model = "llama3.1:latest"
        model_name_clean = "Llama 3.1 (8B)"
        tier = "High Performance"
        context_window = 8192
        description = "Full research reasoning and multi-hop synthesis."
    elif vram_gb >= 3.5 or ram_gb >= 13.5:
        recommended_model = "llama3.2:latest"
        model_name_clean = "Llama 3.2 (3B)"
        tier = "Balanced (Recommended for Students)"
        context_window = 4096
        description = "Fast, accurate academic explanations with low latency."
    else:
        recommended_model = "llama3.2:1b"
        model_name_clean = "Llama 3.2 (1B)"
        tier = "Lightweight / CPU Optimized"
        context_window = 2048
        description = "Sub-second responses designed for budget laptops without dedicated GPU."

    return {
        "ram_gb": round(ram_gb, 1),
        "vram_gb": round(vram_gb, 1),
        "gpu_name": gpu_name,
        "has_nvidia": has_nvidia,
        "recommended_model": recommended_model,
        "model_label": model_name_clean,
        "tier": tier,
        "context_window": context_window,
        "description": description
    }


def check_ollama_service() -> Dict[str, Any]:
    """
    Checks if Ollama service is running on 127.0.0.1:11434
    and lists installed local models.
    """
    try:
        import requests
        resp = requests.get("http://127.0.0.1:11434/api/tags", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return {
                "running": True,
                "models": models,
                "has_models": len(models) > 0,
                "message": f"Ollama is running with {len(models)} model(s) available."
            }
    except Exception as e:
        pass

    return {
        "running": False,
        "models": [],
        "has_models": False,
        "message": "Ollama service is not running or not reachable at http://127.0.0.1:11434"
    }


if __name__ == "__main__":
    print("=== Testing Hardware Prober ===")
    specs = probe_system_hardware()
    print(json.dumps(specs, indent=2))
    print("\n=== Checking Ollama Service ===")
    status = check_ollama_service()
    print(json.dumps(status, indent=2))
