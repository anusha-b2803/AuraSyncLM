"""
Resource Monitor: Stage 3 of Adaptive MMLF Pipeline
Monitors host CPU and RAM utilization using psutil.
Dynamically assigns execution modes (Smart vs Fast), parallel task concurrency,
and selects optimal quantized/lightweight Ollama models.
"""

import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not available; defaulting to safe fallback resource metrics.")


class ResourceMonitor:
    """
    Monitors system resources (RAM & CPU) and configures MMLF pipeline execution:
    - RAM > 8GB AND CPU < 80%  -> smart mode enabled
    - RAM < 8GB OR CPU > 80%   -> fast mode fallback
    - RAM > 16GB               -> 4 parallel tasks
    - RAM 8-16GB               -> 3 parallel tasks
    - RAM 4-8GB                -> 2 parallel tasks
    - RAM < 4GB                -> 1 task (sequential)
    """

    def __init__(
        self,
        fast_model: str = "llama3.2:latest",
        smart_model: str = "llama3.2:latest",
        ollama_host: str = "http://127.0.0.1:11434"
    ):
        self.fast_model = fast_model
        self.smart_model = smart_model
        self.ollama_host = ollama_host

    def get_system_resources(
        self,
        simulate_ram_gb: Optional[float] = None,
        simulate_cpu_percent: Optional[float] = None
    ) -> Dict[str, float]:
        """
        Detects available RAM (GB) and current CPU usage (percent).
        Supports simulation overrides for testing.
        """
        if simulate_ram_gb is not None and simulate_cpu_percent is not None:
            return {
                "ram_available_gb": round(float(simulate_ram_gb), 2),
                "cpu_usage_percent": round(float(simulate_cpu_percent), 2)
            }

        ram_gb = 8.0
        cpu_percent = 20.0

        if PSUTIL_AVAILABLE:
            try:
                mem = psutil.virtual_memory()
                ram_gb = round(mem.available / (1024 ** 3), 2)
                # Quick non-blocking cpu sample
                cpu_percent = round(psutil.cpu_percent(interval=0.1), 2)
            except Exception as e:
                logger.error(f"Error querying psutil: {e}")

        if simulate_ram_gb is not None:
            ram_gb = round(float(simulate_ram_gb), 2)
        if simulate_cpu_percent is not None:
            cpu_percent = round(float(simulate_cpu_percent), 2)

        return {
            "ram_available_gb": ram_gb,
            "cpu_usage_percent": cpu_percent
        }

    def decide_mode(self, ram_available_gb: float, cpu_usage_percent: float) -> str:
        """
        Decision logic:
        - RAM > 8GB AND CPU < 80% -> 'smart'
        - RAM < 8GB OR CPU >= 80% -> 'fast'
        """
        if ram_available_gb > 8.0 and cpu_usage_percent < 80.0:
            return "smart"
        return "fast"

    def determine_parallel_task_count(self, ram_available_gb: float) -> int:
        """
        Computes concurrent task batch size:
        - RAM > 16GB    -> 4 parallel tasks
        - RAM 8-16GB    -> 3 parallel tasks
        - RAM 4-8GB     -> 2 parallel tasks
        - RAM < 4GB     -> 1 task (sequential)
        """
        if ram_available_gb > 16.0:
            return 4
        elif ram_available_gb >= 8.0:
            return 3
        elif ram_available_gb >= 4.0:
            return 2
        else:
            return 1

    def get_available_ollama_models(self) -> List[str]:
        """Queries local Ollama instance for installed models."""
        try:
            import ollama
            client = ollama.Client(host=self.ollama_host)
            resp = client.list()
            models = []
            if hasattr(resp, 'models'):
                for m in resp.models:
                    name = getattr(m, 'model', None) or getattr(m, 'name', None)
                    if name:
                        models.append(str(name))
            elif isinstance(resp, dict):
                for m in resp.get('models', []):
                    name = m.get('name') or m.get('model')
                    if name:
                        models.append(str(name))
            return models
        except Exception as e:
            logger.debug(f"Could not connect to Ollama: {e}")
            return []

    def select_model(self, mode: str) -> str:
        """
        Selects model based on mode with graceful fallback to available models.
        - Fast mode -> fast_model (e.g. phi3/small)
        - Smart mode -> smart_model (e.g. llama3)
        """
        target = self.smart_model if mode == "smart" else self.fast_model
        available = self.get_available_ollama_models()

        if not available:
            # Fallback to requested target model name
            return target

        # Direct match or tag match
        for model_name in available:
            if target.lower() in model_name.lower():
                return model_name

        # Secondary match: pick any suitable model
        if mode == "fast":
            for model_name in available:
                if any(m in model_name.lower() for m in ["phi", "mini", "1b", "3b", "tiny", "gemma:2b"]):
                    return model_name
        else:
            for model_name in available:
                if any(m in model_name.lower() for m in ["llama3", "mistral", "qwen", "llama"]):
                    return model_name

        # Last resort fallback: first available
        return available[0]

    def evaluate(
        self,
        simulate_ram_gb: Optional[float] = None,
        simulate_cpu_percent: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Complete resource evaluation returning resource metrics,
        recommended mode, max parallel workers, and chosen model.
        """
        res = self.get_system_resources(simulate_ram_gb, simulate_cpu_percent)
        ram_gb = res["ram_available_gb"]
        cpu_pct = res["cpu_usage_percent"]

        mode = self.decide_mode(ram_gb, cpu_pct)
        parallel_tasks = self.determine_parallel_task_count(ram_gb)
        selected_model = self.select_model(mode)

        logger.info(
            f"[ResourceMonitor] RAM: {ram_gb}GB, CPU: {cpu_pct}% | Mode: {mode.upper()} | "
            f"Workers: {parallel_tasks} | Model: {selected_model}"
        )

        return {
            "ram_available_gb": ram_gb,
            "cpu_usage_percent": cpu_pct,
            "mode": mode,
            "is_smart_enabled": (mode == "smart"),
            "max_parallel": parallel_tasks,
            "selected_model": selected_model,
            "fast_model": self.fast_model,
            "smart_model": self.smart_model
        }
