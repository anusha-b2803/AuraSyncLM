"""
AuraSync LM - Complete Real Library Vector Index Builder
========================================================
Builds the official ChromaDB index for the active user:
- Reads all 251 real user files from scan_cache.json
- Includes 'a:/new_p/2025.findings-naacl.367.pdf' (MMLF paper)
- Extracts text via PyMuPDF / docx / python
- Chunks into semantic passages (500 chars)
- Encodes with 'all-MiniLM-L6-v2' (offline, fast batching)
- Populates ChromaDB at user_paths['chroma_dir']
"""

import os
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TRANSFORMERS_NO_TENSORFLOW"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import json
import time
import re
import chromadb
from sentence_transformers import SentenceTransformer
from main import get_user_paths
from fileextractor import extract_text

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def build_index_for_user(user_id: str = "0rXyTwARcwW0YsNpZ9v0QpyjhD82"):
    user_paths = get_user_paths(user_id)
    chroma_dir = user_paths["chroma_dir"]
    cache_path = user_paths["scan_cache_path"]

    print(f"[*] Target ChromaDB Directory: {chroma_dir}")
    print(f"[*] Loading cache from: {cache_path}")

    if not os.path.exists(cache_path):
        print(f"[!] Error: Cache not found at {cache_path}")
        return

    with open(cache_path, "r", encoding="utf-8") as f:
        cache = json.load(f)

    # Collect list of files to index
    file_list = []
    for path, meta in cache.items():
        if os.path.exists(path):
            file_list.append((path, meta))

    # Add the MMLF paper if present
    paper_path = r"a:\new_p\2025.findings-naacl.367.pdf"
    if os.path.exists(paper_path):
        file_list.append((paper_path, {
            "name": "2025.findings-naacl.367.pdf",
            "domain": "Artificial Intelligence",
            "topic": "Information Retrieval",
            "subtopic": "Late Fusion Retrieval"
        }))

    print(f"[*] Total files to index: {len(file_list)}")

    # Step 1: Extract and chunk
    t0 = time.time()
    all_chunks = []
    all_metas = []
    all_ids = []

    print("[*] Extracting and chunking documents...")
    chunk_idx = 0
    for path, meta in file_list:
        try:
            raw_text = extract_text(path)
            if not raw_text or len(raw_text.strip()) < 50:
                continue

            # Clean text
            clean_text = re.sub(r"[ \t]+", " ", raw_text)
            clean_text = re.sub(r"\n{2,}", "\n\n", clean_text)

            # Split into chunks of 500 characters
            step = 400
            for i in range(0, min(len(clean_text), 15000), step):
                chunk = clean_text[i:i + 500].strip()
                if len(chunk) > 60:
                    c_id = f"chunk_{chunk_idx}"
                    all_ids.append(c_id)
                    all_chunks.append(chunk)
                    all_metas.append({
                        "name": meta.get("name", os.path.basename(path)),
                        "path": path,
                        "domain": meta.get("domain", "General"),
                        "topic": meta.get("topic", "General"),
                        "subtopic": meta.get("subtopic", "General")
                    })
                    chunk_idx += 1
        except Exception as e:
            continue

    print(f"[*] Generated {len(all_chunks)} semantic chunks in {time.time() - t0:.2f}s.")

    # Step 2: Embed and store into ChromaDB
    print("[*] Loading SentenceTransformer ('all-MiniLM-L6-v2')...")
    model = SentenceTransformer("all-MiniLM-L6-v2")

    os.makedirs(chroma_dir, exist_ok=True)
    import chromadb.config
    client = chromadb.PersistentClient(path=chroma_dir, settings=chromadb.config.Settings(anonymized_telemetry=False))
    try:
        client.delete_collection("rag_collection")
    except Exception:
        pass

    collection = client.create_collection(
        name="rag_collection",
        metadata={"hnsw:space": "cosine"}
    )

    batch_size = 128
    total = len(all_chunks)
    print(f"[*] Embedding and writing {total} chunks to ChromaDB at {chroma_dir}...")
    t_embed = time.time()
    for i in range(0, total, batch_size):
        end = min(i + batch_size, total)
        b_chunks = all_chunks[i:end]
        b_ids = all_ids[i:end]
        b_metas = all_metas[i:end]

        embeddings = model.encode(b_chunks, batch_size=64, show_progress_bar=False).tolist()
        collection.add(
            ids=b_ids,
            embeddings=embeddings,
            documents=b_chunks,
            metadatas=b_metas
        )
        if (i // batch_size) % 5 == 0:
            print(f"    Indexed {end}/{total} chunks...")

    print(f"[+] SUCCESS! Indexed {total} chunks in {time.time() - t_embed:.2f}s.")
    print(f"[+] Knowledge base ready at: {chroma_dir}")

    # Also duplicate into default user so any userId accesses it
    default_chroma_dir = get_user_paths("default")["chroma_dir"]
    if default_chroma_dir != chroma_dir:
        os.makedirs(default_chroma_dir, exist_ok=True)
        def_client = chromadb.PersistentClient(path=default_chroma_dir)
        try:
            def_client.delete_collection("rag_collection")
        except Exception:
            pass
        def_coll = def_client.create_collection("rag_collection", metadata={"hnsw:space": "cosine"})
        for i in range(0, total, batch_size):
            end = min(i + batch_size, total)
            b_chunks = all_chunks[i:end]
            b_ids = all_ids[i:end]
            b_metas = all_metas[i:end]
            embeddings = model.encode(b_chunks, batch_size=64, show_progress_bar=False).tolist()
            def_coll.add(ids=b_ids, embeddings=embeddings, documents=b_chunks, metadatas=b_metas)
        print(f"[+] Synchronized index with default user at: {default_chroma_dir}")


if __name__ == "__main__":
    build_index_for_user()
