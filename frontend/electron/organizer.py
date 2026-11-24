import sys
import os
import json
import re
import traceback
from collections import Counter

# Broad stops to clean titles
STOP_WORDS = {
    'and', 'the', 'of', 'to', 'for', 'in', 'with', 'on', 'a', 'an', 'is', 'that', 'this',
    'by', 'from', 'as', 'at', 'pdf', 'docx', 'doc', 'txt', 'jpg', 'png', 'from', 'or'
}

def run_lda(docs, n_topics=8, n_iterations=30):
    """
    Pure Python Collapsed Gibbs Sampling for Latent Dirichlet Allocation (LDA).
    """
    import random
    from collections import Counter, defaultdict

    # 1. Prepare Vocabulary
    vocab = list(set([w for doc in docs for w in doc]))
    W = len(vocab)
    D = len(docs)
    if W == 0 or D == 0:
        return {}, [], []

    alpha = 50.0 / n_topics
    beta = 0.1

    # Counts
    n_d_z = [Counter() for _ in range(D)] # Doc-topic
    n_z_w = [Counter() for _ in range(n_topics)] # Topic-word
    n_z = [0] * n_topics # Topic counts Sum

    assignments = []
    
    # Random Init
    for d, doc in enumerate(docs):
        doc_asgn = []
        for w in doc:
            z = random.randint(0, n_topics - 1)
            doc_asgn.append(z)
            n_d_z[d][z] += 1
            n_z_w[z][w] += 1
            n_z[z] += 1
        assignments.append(doc_asgn)

    # Gibbs Sampling
    for _ in range(n_iterations):
        for d, doc in enumerate(docs):
            for i, w in enumerate(doc):
                z = assignments[d][i]
                # Decrement
                n_d_z[d][z] -= 1
                n_z_w[z][w] -= 1
                n_z[z] -= 1

                # Probabilities
                p = []
                for k in range(n_topics):
                    p_k = (n_d_z[d][k] + alpha) * (n_z_w[k][w] + beta) / (n_z[k] + W * beta)
                    p.append(p_k)

                # Sample new topic
                u = random.random() * sum(p)
                accum = 0
                new_z = 0
                for k, pk in enumerate(p):
                    accum += pk
                    if u < accum:
                        new_z = k
                        break

                # Increment
                assignments[d][i] = new_z
                n_d_z[d][new_z] += 1
                n_z_w[new_z][w] += 1
                n_z[new_z] += 1

    return n_d_z, n_z_w, vocab

def get_topic_names(n_z_w, n_topics=8):
    names = {}
    if not n_z_w:
        return {k: f"Topic {k+1}" for k in range(n_topics)}
    for k in range(n_topics):
        if k >= len(n_z_w):
            names[k] = f"Topic {k+1}"
            continue
        top_words = [w for w, _ in n_z_w[k].most_common(2)]
        if not top_words:
            names[k] = f"Topic {k+1}"
        else:
            names[k] = " / ".join(top_words).title()
    return names

FILE_TYPE_MAP = {
    'Images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'],
    'Videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv'],
    'Audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
    'Documents': ['.pdf', '.doc', '.docx', '.txt', '.txt', '.odt', '.rtf', '.epub'],
    'Spreadsheets': ['.xls', '.xlsx', '.csv', '.ods'],
    'Presentations': ['.ppt', '.pptx', '.odp'],
    'Code': ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.cs', '.go', '.html', '.css', '.json', '.xml'],
    'Archives': ['.zip', '.rar', '.7z', '.tar', '.gz'],
}

def get_file_type(filepath):
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()
    for file_type, extensions in FILE_TYPE_MAP.items():
        if ext in extensions:
            return file_type
    return 'Other'

def main():
    try:
        # 1. Parse Arguments
        if len(sys.argv) < 2:
            print(json.dumps({"success": False, "error": "No arguments provided"}))
            return

        opts = json.loads(sys.argv[1])
        scan_roots = opts.get('scan_roots', [])
        dry_run = opts.get('dry_run', True)

        if not scan_roots:
            print(json.dumps({"success": False, "error": "No scan_roots provided"}))
            return

        # 2. Walk Directories
        scanned_files = []
        for root_dir in scan_roots:
            if not os.path.exists(root_dir):
                continue
            
            # Simple walk with maximum limit to prevent hangs on full C:\ traversal
            count = 0
            for dirpath, dirnames, filenames in os.walk(root_dir):
                # Skip massive build/module folders
                if any(x in dirpath for x in ['node_modules', '.git', 'dist', 'venv']):
                    continue
                
                for f in filenames:
                    ext = os.path.splitext(f)[1].lower()
                    # Skip code and system files as requested
                    CODE_EXTS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.xml', '.yaml', '.yml', '.md', '.bat', '.sh', '.sql', '.cpp', '.c', '.h', '.java', '.class', '.dll', '.sys', '.exe', '.config'}
                    if ext in CODE_EXTS:
                        continue

                    filepath = os.path.join(dirpath, f)
                    scanned_files.append(filepath)
                    count += 1
                    if count >= 3000: # Limit for safety
                        break
                if count >= 3000:
                    break

        total_files = len(scanned_files)

        # 3. Fit LDA Model
        docs = []
        import re
        for filepath in scanned_files:
            name = os.path.splitext(os.path.basename(filepath))[0]
            tokens = [w for w in re.sub(r'[^a-zA-Z]', ' ', name).lower().split() if w not in STOP_WORDS and len(w) > 2]
            docs.append(tokens)

        n_topics = 8
        n_d_z, n_z_w, vocab = run_lda(docs, n_topics=n_topics, n_iterations=30)
        topic_names = get_topic_names(n_z_w, n_topics=n_topics)

        organization_map = {} # "Type/Topic" -> [paths]
        files_list = []
        topics_discovered = set()

        import hashlib

        for i, filepath in enumerate(scanned_files):
            file_type = get_file_type(filepath)
            
            if i < len(n_d_z) and n_d_z[i]:
                best_topic_id = max(n_d_z[i], key=n_d_z[i].get)
                topic = topic_names.get(best_topic_id, 'Other')
            else:
                topic = 'Other'
            
            if topic != 'Other':
                topics_discovered.add(topic)

            key = f"{file_type}/{topic}"
            if key not in organization_map:
                organization_map[key] = []
            organization_map[key].append(filepath)

            # Build formal record for rendering
            file_id = hashlib.md5(filepath.encode('utf-8')).hexdigest()
            files_list.append({
                "id": file_id,
                "name": os.path.basename(filepath),
                "path": filepath,
                "fileType": file_type,
                "topic": topic,
                "contexts": []
            })

            # Periodically emit progress to stdout so main.js reads it
            if i % 10 == 0 or i == total_files - 1:
                progress_msg = {
                    "type": "progress",
                    "current": i + 1,
                    "total": total_files,
                    "file": os.path.basename(filepath)
                }
                print(json.dumps(progress_msg), flush=True)

        # 4. Final Output
        result = {
            "success": True,
            "data": {
                "organization_map": organization_map,
                "files": files_list,
                "stats": {
                    "total_processed": total_files,
                    "topics_discovered": list(topics_discovered)
                }
            }
        }
        print(json.dumps(result), flush=True)

    except Exception as e:
        print(json.dumps({
            "success": False, 
            "error": str(e),
            "traceback": traceback.format_exc()
        }), flush=True)

if __name__ == "__main__":
    main()
