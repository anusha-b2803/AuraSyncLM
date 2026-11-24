import os
import subprocess
import sys

def build():
    print("Starting Backend Packaging...")
    
    # 1. Install PyInstaller if not present
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
    
    # 2. Define the command
    # --onefile: bundle everything into a single exe
    # --noconsole: don't show a black command prompt window
    # --name: the name of the exe
    cmd = [
        "pyinstaller",
        "--noconsole",
        "--onefile", # Bundle into a single exe
        "--name", "aurasync-backend",
        "--hidden-import", "sklearn.utils._typedefs",
        "--hidden-import", "sklearn.neighbors._partition_nodes",
        "--hidden-import", "sklearn.neighbors._quad_tree",
        "--hidden-import", "sklearn.tree._utils",
        "--hidden-import", "sentence_transformers",
        "--hidden-import", "keybert",
        "--hidden-import", "ollama",
        "--hidden-import", "chromadb",
        "--hidden-import", "chromadb.telemetry.posthog",
        "--hidden-import", "chromadb.migrations",
        "--hidden-import", "fastapi",
        "--hidden-import", "uvicorn",
        "api.py"
    ]
    
    print(f"Running command: {' '.join(cmd)}")
    subprocess.check_call(cmd)
    
    print("\nBackend packaged successfully! You can find it in the 'dist' folder.")

if __name__ == "__main__":
    build()
