import os
import sys
import json

# Fix for HuggingFace download timeouts on slow networks
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "120"
import logging
import shutil
import re
import hashlib
import concurrent.futures
import ctypes
import pickle
import warnings
from collections import Counter
# from sklearn.feature_extraction.text import TfidfVectorizer # Removed - migrating to ChromaDB

# --- Suppress Noisy Warnings ---
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

os.environ["TRANSFORMERS_NO_TENSORFLOW"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
# Removed CUDA disable to allow GPU acceleration

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("ollama").setLevel(logging.WARNING)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)

from fileextractor import extract_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =========================
# CONFIG
# =========================
USER_HOME = os.path.expanduser("~")
DATA_DIR = os.path.join(USER_HOME, ".aurasync-lm")
OUTPUT_FOLDER = os.path.join(DATA_DIR, "organized_files")
INDEX_PATH = os.path.join(DATA_DIR, "rag_index.pkl")
SCAN_CACHE_PATH = os.path.join(DATA_DIR, "scan_cache.json")

SUPPORTED_FORMATS = (
    ".txt",".pdf", ".doc", ".docx",
    ".ppt", ".pptx"
)

def get_user_paths(user_id: str):
    """Get isolated paths for a specific user."""
    user_data_dir = os.path.join(DATA_DIR, user_id)
    return {
        "data_dir": user_data_dir,
        "output_folder": os.path.join(user_data_dir, "organized_files"),
        "chroma_dir": os.path.join(user_data_dir, "chroma_db"),
        "scan_cache_path": os.path.join(user_data_dir, "scan_cache.json"),
        "structure_path": os.path.join(user_data_dir, "structure.json")
    }

EXCLUDED_DIRS = {
    '$recycle.bin', 'windows', 'program files', 'program files (x86)',
    'node_modules', '.git', '__pycache__', '.aurasync-lm',
    'appdata', 'system volume information', 'recovery',
    'programdata', 'msocache', 'intel', 'amd', 'nvidia',
}

SCAN_PATHS = []
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# =========================
# AUTO DRIVE DETECTION
# =========================
def get_all_drives():
    """Detect all user-accessible drives on Windows, excluding C:."""
    drives = []
    try:
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        for i in range(26):
            if bitmask & (1 << i):
                letter = chr(65 + i)
                if letter == 'C': # Already added home, avoid scanning root C:\
                    continue
                drive = f"{letter}:\\"
                drive_type = ctypes.windll.kernel32.GetDriveTypeW(drive)
                if drive_type in (2, 3, 4) and os.path.exists(drive):
                    if drive not in drives:
                        drives.append(drive)
    except Exception:
        pass
    return drives

# =========================
# UTILS
# =========================
def sanitize_name(name):
    name = re.sub(r'[\\/*?"<>|:]', '', str(name))
    name = name.strip()
    name = re.sub(r'\s+', ' ', name)
    return name[:60] if name else "General"

# --- Noise/Meaningless Headings Blacklist ---
SUBTOPIC_BLACKLIST = {
    'return', 'print', 'write', 'question', 'problem', 'exercise', 'exper', 'experiment',
    'output', 'input', 'statement', 'code', 'snippet', 'pilani', 'bits', 'solution',
    'answer', 'task', 'lab', 'session', 'module', 'unit', 'chapter', 'section',
    'void', 'int', 'char', 'string', 'bool', 'true', 'false', 'null', 'none', 'undefined'
}

def clean_subtopic_name(name, topic_context="General"):
    """Filters out meaningless or code-fragment names."""
    if not name or not isinstance(name, str):
        return topic_context
    
    clean = sanitize_name(name)
    parts = clean.lower().split()
    
    # If any part of the name is in the blacklist, or the name is too short
    if any(p in SUBTOPIC_BLACKLIST for p in parts) or len(clean) < 3:
        return f"{topic_context} Reference"
    
    return clean

def get_file_hash(path):
    try:
        stat = os.stat(path)
        return f"{stat.st_size}_{stat.st_mtime}"
    except:
        return None

# =========================
# STOP WORDS
# =========================
STOP_WORDS = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','are','was','were','be','been','have','has','had','do',
    'does','did','will','would','could','should','may','might','this','that',
    'these','those','it','its','we','you','he','she','they','i','my','your',
    'our','their','as','if','not','no','can','also','which','who','what',
    'when','where','how','about','into','than','then','so','such','after',
    'before','while','during','between','through','each','more','most','other',
    'some','all','any','both','few','same','own','used','using','based','paper',
    'proposed','method','approach','result','results','figure','table','section',
    'chapter','page','study','show','shown','shows','given','present','new',
    'one','two','three','data','system','model','propose','algorithm','using',
    'first','second','third','since','thus','whereas','hence','therefore',
    'however','although','because','while','whether','without','within','around',
    'every','only','even','much','many','just','very','also','both','further',
    'well','like','work','used','type','make','take','come','good','high',
    'large','small','general','different','various','specific','following',
    'important','possible','required','applied','existing','current','previous',
}

# =========================
# KEYWORD SUBTOPIC EXTRACTOR
# =========================
def extract_subtopic(text):
    """
    Advanced Keyword Extractor: prioritizes technical bi-grams and meaningful nouns.
    """
    sample = text[:5000].lower()
    words = re.findall(r'\b[a-zA-Z]{4,}\b', sample)
    
    meaningful = [w for w in words if w not in STOP_WORDS and len(w) > 4]
    
    if not meaningful:
        return "General Source"

    bigrams = []
    for i in range(len(meaningful)-1):
        bigrams.append(f"{meaningful[i]} {meaningful[i+1]}")
    
    b_freq = Counter(bigrams)
    w_freq = Counter(meaningful)
    
    top_b = b_freq.most_common(2)
    if top_b and top_b[0][1] > 1:
        return sanitize_name(top_b[0][0].title())
    
    top_w = w_freq.most_common(1)
    if top_w:
        return sanitize_name(top_w[0][0].title())
    
    return "Archive"

# =========================
# OLLAMA CLUSTER NAMER
# =========================
_ollama_model = None

def get_ollama_model():
    """Get the best available Ollama model, cached."""
    global _ollama_model
    if _ollama_model:
        return _ollama_model
    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')
        for model in ['llama3', 'llama3.1', 'mistral', 'phi']:
            try:
                client.show(model)
                _ollama_model = model
                logger.info(f"Using Ollama model: {model}")
                return model
            except:
                continue
    except:
        pass
    return None





# =========================
# EMBEDDING MODEL
# =========================
_embed_model = None

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        try:
            from models import get_models
            _embed_model, _ = get_models()
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            _embed_model = None
    return _embed_model


# =========================
# FILE DISCOVERY
# =========================
def get_files(paths, progress_callback=None):
    files = []
    checked = 0
    logger.info(f"Starting file discovery on paths: {paths}")
    
    for base_path in paths:
        if not os.path.exists(base_path):
            logger.warning(f"Scan path does not exist: {base_path}")
            continue
            
        logger.info(f"Walking directory: {base_path}")
        for root, dirs, fs in os.walk(base_path, topdown=True):
            # Optimization: Skip excluded directories
            dirs[:] = [
                d for d in dirs
                if d.lower() not in EXCLUDED_DIRS
                and not d.startswith('.')
                and not d.startswith('$')
            ]
            
            # Skip if the current root itself is excluded
            if any(excl in root.lower() for excl in EXCLUDED_DIRS):
                continue
                
            for f in fs:
                checked += 1
                if any(f.lower().endswith(ext) for ext in SUPPORTED_FORMATS) and not f.startswith('~$'):
                    file_path = os.path.join(root, f)
                    files.append(file_path)
                    
                    if len(files) % 20 == 0:
                        logger.info(f"Found {len(files)} files so far...")
                        if progress_callback:
                            progress_callback(f"Discovery: Found {len(files)} research files...", len(files), 0)
                            
    logger.info(f"Discovery complete. Scanned {checked} total files, found {len(files)} matching research documents.")
    return files

# ==========================================
# CLUSTER-BASED CLASSIFICATION ENGINE
# ==========================================
def classify_all_files(processed_items, progress_callback=None):
    """
    Hybrid TF-IDF + Sentence Embedding Cluster-then-Name approach:
    1. TF-IDF: sharp domain-level keyword separation.
    2. Sentence Embeddings: semantic/contextual similarity.
    3. KMeans on combined features → tight, accurate clusters.
    4. Ollama names each cluster ONCE (not per-file).
    5. Per-file subtopic from its own top keywords.
    """
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize
    from sklearn.cluster import AgglomerativeClustering

    n = len(processed_items)
    if n == 0:
        return processed_items

    texts_for_features = [item['text'][:5000] for item in processed_items]

    # --- 1. TF-IDF Vectors ---
    if progress_callback:
        progress_callback(f"Computing TF-IDF features for {n} documents...", 0, n)
    try:
        tfidf = TfidfVectorizer(
            max_features=5000,
            stop_words='english',
            ngram_range=(1, 2),       # unigrams + bigrams for technical terms
            min_df=1,
            sublinear_tf=True         # log-scale TF for better balance
        )
        tfidf_matrix = tfidf.fit_transform(texts_for_features).toarray()
        tfidf_norm = normalize(tfidf_matrix, norm='l2')
        logger.info(f"TF-IDF: {tfidf_matrix.shape}")
    except Exception as e:
        logger.warning(f"TF-IDF failed: {e}")
        tfidf_norm = None

    # --- 2. Sentence Embeddings ---
    if progress_callback:
        progress_callback(f"Computing semantic embeddings for {n} documents...", 0, n)
    try:
        embed_model = get_embed_model()
        if embed_model:
            embeddings = embed_model.encode(
                [t[:2000] for t in texts_for_features],
                batch_size=32,
                show_progress_bar=False
            )
            emb_norm = normalize(embeddings, norm='l2')
            logger.info(f"Embeddings: {emb_norm.shape}")
        else:
            logger.warning("Embedding model missing, falling back to basic TF-IDF clustering.")
            emb_norm = None
    except Exception as e:
        logger.warning(f"Embedding failed: {e}")
        emb_norm = None

    # --- 3. Combine: weighted concatenation (0.3 TF-IDF / 0.7 Embeddings) ---
    # We also inject filename features by adding the filename to the text snippets
    if tfidf_norm is not None and emb_norm is not None:
        combined = np.hstack([tfidf_norm * 0.3, emb_norm * 0.7])
    elif tfidf_norm is not None:
        combined = tfidf_norm
    elif emb_norm is not None:
        combined = emb_norm
    else:
        # Fallback logic...
        for item in processed_items:
            fname = os.path.splitext(item['name'])[0].replace('_', ' ').replace('-', ' ')
            parts = fname.split()
            item['domain'] = sanitize_name(parts[0]) if parts else "General"
            item['topic'] = sanitize_name(' '.join(parts[1:3])) if len(parts) > 1 else "Reference"
            item['subtopic'] = "General"
        return processed_items

    # --- 4. Automatic Density-Based Clustering (Perfect Grouping) ---
    if progress_callback:
        progress_callback(f"Synthesizing {n} documents using semantic density...", 0, n)

    if n < 2:
        labels = [0] * n
    else:
        try:
            # Agglomerative clustering with a distance threshold automatically discovers the perfect 
            # number of topics without forcing unrelated files together (which KMeans suffers from).
            clusterer = AgglomerativeClustering(
                n_clusters=None, 
                distance_threshold=0.95, # Euclidean distance on L2-normalized vectors
                linkage='ward'
            )
            labels = clusterer.fit_predict(combined)
        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            labels = [0] * n

    # --- 5. High-Fidelity Hub Naming ---
    cluster_names = {}
    unique_labels = sorted(list(set(labels)))
    
    for cluster_id in unique_labels:
        indices = np.where(labels == cluster_id)[0]
        # Mix filenames and content for the naming prompt
        sample_info = []
        for idx in indices[:8]:
            item = processed_items[idx]
            sample_info.append(f"File: {item['name']}\nSnippet: {item['text'][:800]}")
        
        context_block = "\n\n---\n\n".join(sample_info)

        if progress_callback:
            progress_callback(
                f"Naming Research Hub {int(cluster_id)+1}/{len(unique_labels)}...",
                int(cluster_id) + 1, len(unique_labels)
            )

        prompt = f"""You are an expert librarian. Group these files.
FILES:
{context_block[:6000]}

RULES:
1. "domain": Broad academic/professional field (e.g. "Computer Science", "Business"). Max 3 words.
2. "topic": Specific subject within domain (e.g. "Machine Learning", "Marketing"). Max 4 words.
3. DO NOT repeat the Domain in the Topic.
4. Return ONLY valid JSON.

FORMAT: {{"domain": "...", "topic": "..."}}"""

        domain, topic = "General", "Research"
        try:
            import ollama
            model = get_ollama_model()
            resp = ollama.generate(model=model, prompt=prompt, format='json', options={'temperature': 0.1})
            data = json.loads(resp['response'])
            domain = data.get('domain', domain)
            topic = data.get('topic', topic)
        except Exception as e:
            logger.warning(f"AI Hub naming failed: {e}")

        # Prevent redundancy
        if domain.lower() in topic.lower():
            topic = topic.lower().replace(domain.lower(), "").strip().title() or "General Concepts"

        cluster_names[int(cluster_id)] = {
            "domain": sanitize_name(domain).title(),
            "topic": sanitize_name(topic).title()
        }

    # --- 6. Intelligent Mapping ---
    try:
        from keybert import KeyBERT
        kw_model = KeyBERT(model=get_embed_model())
    except:
        kw_model = None

    for i, item in enumerate(processed_items):
        c_info = cluster_names[int(labels[i])]
        item['domain'] = c_info['domain']
        item['topic'] = c_info['topic']
        
        # File-specific Subtopic Extraction
        subtopic = None
        
        if kw_model:
            try:
                # Extract top bi-gram keyword directly from this specific document
                keywords = kw_model.extract_keywords(
                    item['name'] + " " + item['text'][:2000],
                    keyphrase_ngram_range=(1, 3),
                    stop_words='english',
                    use_mmr=True, diversity=0.8, top_n=1
                )
                if keywords:
                    subtopic = sanitize_name(keywords[0][0].title())
            except:
                pass
                
        if not subtopic:
            subtopic = extract_subtopic(item['name'] + " " + item['text'])
            
        # Aggressive Cleanup of Redundant Names
        topic_lower = item['topic'].lower()
        domain_lower = item['domain'].lower()
        sub_lower = subtopic.lower()
        
        if topic_lower in sub_lower or sub_lower in topic_lower or domain_lower in sub_lower:
            # Strip out overlapping words completely
            for word in set(topic_lower.split() + domain_lower.split()):
                if len(word) > 3:
                    sub_lower = sub_lower.replace(word, "")
            
            subtopic = sub_lower.strip().title()
            
        if not subtopic or len(subtopic.strip()) < 4:
            subtopic = "Core Documents"
            
        item['subtopic'] = subtopic
        item['embedding'] = emb_norm[i].tolist() if emb_norm is not None else []

    return processed_items


# =========================
# SCAN & ORGANIZE CORE
# =========================
def organize_files(paths, user_id: str = "default", force: bool = False, progress_callback=None):
    """Main pipeline: Scan -> Extract -> AI Classify -> Organize -> Index."""
    paths = [p for p in paths if os.path.exists(p)]
    if not paths:
        return {"status": "error", "message": "No valid scan paths found."}

    user_paths = get_user_paths(user_id)
    os.makedirs(user_paths["data_dir"], exist_ok=True)
    os.makedirs(user_paths["output_folder"], exist_ok=True)

    def save_scan_cache(cache):
        with open(user_paths["scan_cache_path"], "w") as f:
            json.dump(cache, f)

    def load_scan_cache():
        if os.path.exists(user_paths["scan_cache_path"]) and not force:
            try:
                with open(user_paths["scan_cache_path"], "r") as f:
                    return json.load(f)
            except:
                return {}
        return {}

    # Step 1: File Discovery
    if progress_callback:
        progress_callback("Discovering files across all drives...", 0, 0)
    files = get_files(paths, progress_callback)
    total = len(files)
    if total == 0:
        return {"status": "error", "message": "No supported files found on the selected drives."}

    logger.info(f"Found {total} files.")
    if progress_callback:
        progress_callback(f"Found {total} files. Extracting content...", 0, total)

    # Step 2: Load cache, identify new files
    cache = load_scan_cache()
    new_cache = {}
    cached_items = []
    new_file_args = []

    for path in files:
        file_hash = get_file_hash(path)
        cached = cache.get(path)
        if cached and cached.get("hash") == file_hash and "domain" in cached and cached.get("domain") not in ("General_Research", "Uncategorized_Research"):
            cached_items.append({**cached, "path": path})
            new_cache[path] = cached
        else:
            new_file_args.append((path, file_hash))

    logger.info(f"{len(cached_items)} from cache, {len(new_file_args)} need processing.")

    # Step 3: Extract text from new files in parallel
    def extract_one(args):
        path, file_hash = args
        try:
            raw = extract_text(path)
            if not raw or len(raw.strip()) < 80:
                return None
            return {
                "path": path,
                "name": os.path.basename(path),
                "hash": file_hash,
                "text": raw[:50000],
            }
        except:
            return None

    new_items = []
    done_count = [0]
    if new_file_args:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            futures = {executor.submit(extract_one, args): args for args in new_file_args}
            for future in concurrent.futures.as_completed(futures):
                done_count[0] += 1
                if progress_callback and done_count[0] % 50 == 0:
                    progress_callback(
                        f"Reading files: {done_count[0]}/{len(new_file_args)}...",
                        done_count[0], len(new_file_args)
                    )
                result = future.result()
                if result:
                    new_items.append(result)

    logger.info(f"Extracted text from {len(new_items)} new files.")

    # Step 4: Cluster + Name new files (Ollama called once per cluster, not per file)
    if new_items:
        if progress_callback:
            progress_callback(f"Running AI classification on {len(new_items)} files...", 0, len(new_items))
        new_items = classify_all_files(new_items, progress_callback)

        for item in new_items:
            new_cache[item["path"]] = {k: v for k, v in item.items() if k not in ('text', 'embedding')}

    all_items = cached_items + new_items
    if not all_items:
        return {"status": "error", "message": "No processable content found."}

    save_scan_cache(new_cache)

    # Step 5: Virtual organization (No physical copying)
    if progress_callback:
        progress_callback("Organizing into Virtual Domain → Topic → Subtopic folders...", 0, 0)

    final_groups = {}
    for item in all_items:
        d, t, s = item["domain"], item["topic"], item["subtopic"]
        final_groups.setdefault(d, {}).setdefault(t, {}).setdefault(s, []).append(item)

    organized_structure = []
    all_texts = []
    all_file_info = []

    for d_name, topics in final_groups.items():
        d_subs = []
        for t_name, subtopics in topics.items():
            t_files = []
            for s_name, sub_files in subtopics.items():
                group_files = []
                for f in sub_files:
                    group_files.append({"name": f["name"], "path": f["path"]})
                    all_texts.append(f.get("text", ""))
                    all_file_info.append((f["name"], f["path"], d_name, t_name, s_name))
                if group_files:
                    t_files.append({"name": s_name, "files": group_files})
            if t_files:
                d_subs.append({"name": t_name, "subfolders": t_files})
        if d_subs:
            organized_structure.append({"name": d_name, "subfolders": d_subs})

    # Save structure to JSON file for quick frontend loading
    try:
        with open(user_paths["structure_path"], "w", encoding="utf-8") as f:
            json.dump(organized_structure, f)
    except Exception as e:
        logger.error(f"Error saving structure.json: {e}")

    # Step 6: Build RAG Knowledge Base
    if progress_callback:
        progress_callback(f"Building RAG knowledge base from {len(all_texts)} documents...", 0, 0)

    _build_rag_index(all_texts, all_file_info, user_id)

    if progress_callback:
        progress_callback("Complete! Knowledge base ready.", 100, 100)

    return {
        "status": "success",
        "structure": organized_structure,
        "stats": {
            "total_scanned": total,
            "total_indexed": len(all_texts),
            "domains": len(final_groups)
        }
    }


# =========================
# RAG INDEX BUILDER
# =========================
def _build_rag_index(texts, file_info_list, user_id: str = "default"):
    """Build the RAG index with semantic overlapping chunks."""
    user_paths = get_user_paths(user_id)

    def chunk_text(text):
        # Improved semantic chunking using paragraphs and sentences
        paragraphs = re.split(r'\n\s*\n', text)
        chunks = []
        current_chunk = ""
        for p in paragraphs:
            if len(current_chunk) + len(p) < 1500:
                current_chunk += p + "\n\n"
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                if len(p) > 1500:
                    sentences = re.split(r'(?<=[.!?]) +', p)
                    current_chunk = ""
                    for s in sentences:
                        if len(current_chunk) + len(s) < 1500:
                            current_chunk += s + " "
                        else:
                            if current_chunk.strip():
                                chunks.append(current_chunk.strip())
                            current_chunk = s + " "
                else:
                    current_chunk = p + "\n\n"
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        return chunks

    model = get_embed_model()

    all_chunks = []
    all_meta = []
    for text, file_info in zip(texts, file_info_list):
        if not text or not text.strip():
            continue
        for chunk in chunk_text(text):
            all_chunks.append(chunk)
            all_meta.append(file_info)

    if not all_chunks:
        logger.warning("No chunks to index.")
        return

    logger.info(f"Encoding {len(all_chunks)} chunks for ChromaDB...")
    if model:
        embeddings = model.encode(all_chunks, batch_size=64, show_progress_bar=False)
    else:
        logger.warning("Local embedding model missing, attempting Ollama fallback for RAG indexing...")
        try:
            import ollama
            client = ollama.Client(host='http://127.0.0.1:11434')
            embeddings = []
            for t in all_chunks:
                resp = client.embeddings(model='llama3.1:latest', prompt=t[:8000])
                embeddings.append(resp['embedding'])
        except Exception as e:
            logger.error(f"Ollama fallback failed: {e}. RAG indexing cannot proceed.")
            return []

    import chromadb
    chroma_dir = user_paths["chroma_dir"]
    client = chromadb.PersistentClient(path=chroma_dir)
    try:
        client.delete_collection(name="rag_collection")
    except:
        pass
    collection = client.create_collection(name="rag_collection")

    batch_size = 5000
    for i in range(0, len(all_chunks), batch_size):
        end = min(i + batch_size, len(all_chunks))
        batch_chunks = all_chunks[i:end]
        batch_embs = [e.tolist() if hasattr(e, 'tolist') else e for e in embeddings[i:end]]
        batch_meta = [{"name": m[0], "path": m[1], "domain": m[2], "topic": m[3], "subtopic": m[4]} for m in all_meta[i:end]]
        batch_ids = [f"chunk_{j}" for j in range(i, end)]
        collection.add(
            documents=batch_chunks,
            embeddings=batch_embs,
            metadatas=batch_meta,
            ids=batch_ids
        )
        
    logger.info(f"ChromaDB index: {len(all_chunks)} chunks saved for user {user_id}.")


if __name__ == "__main__":
    drives = get_all_drives()
    print(f"Scanning: {drives}")
    organize_files(drives)