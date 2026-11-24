import os
os.environ["ANONYMIZED_TELEMETRY"] = "False"
import re
import json
import asyncio
import logging
# from sklearn.metrics.pairwise import cosine_similarity # Removed - migrating to ChromaDB
from main import get_user_paths


logging.getLogger("httpx").setLevel(logging.WARNING)

# =========================
# CONFIG
# =========================
USER_HOME = os.path.expanduser("~")
DATA_DIR = os.path.join(USER_HOME, ".aurasync-lm")

# def get_user_index_path(user_id: str):
#     return os.path.join(DATA_DIR, user_id, "rag_index.pkl")

logger = logging.getLogger(__name__)

# =========================
# OLLAMA STATUS
# =========================
_USE_OLLAMA = None

def get_ollama_status():
    """Check if Ollama is running and has models."""
    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')
        models_resp = client.list()
        
        # Check if any preferred models are present
        models = []
        if hasattr(models_resp, 'models'):
            models = [m.model for m in models_resp.models]
        elif isinstance(models_resp, dict):
            models = [m.get('name') for m in models_resp.get('models', [])]
        
        has_models = any(m for m in models if any(target in m.lower() for target in ['llama', 'mistral', 'phi']))
        
        if not has_models:
            return {"active": False, "flaw": "Models missing", "message": "Ollama is running, but no suitable models (llama3, mistral, etc.) were found. Please run 'ollama pull llama3'."}
            
        return {"active": True, "message": "Neural system active."}
    except Exception as e:
        return {"active": False, "flaw": "Service offline", "message": f"Ollama service is not reachable. Ensure it is running on port 11434. Error: {str(e)}"}

# =========================
# INDEX CACHE (Scoped by User)
# =========================
# In-memory storage for loaded indexes (Thread-safe dict: userId -> {data, vectorizer})
_CACHED_INDEX = {}

# Deprecated: load_index is no longer used as we query ChromaDB directly in retrieve()
# def load_index(user_id: str = "default"):
#     ...

def clear_cache(user_id: str = None):
    global _CACHED_INDEX, _USE_OLLAMA
    if user_id:
        _CACHED_INDEX.pop(user_id, None)
    else:
        _CACHED_INDEX = {}
    _USE_OLLAMA = None

# =========================
# OFFLINE FALLBACK (Intelligent Extractive Summarization)
# =========================
def generate_offline_answer(contexts, query=None):
    """
    Intelligent extractive fallback engine:
    Extracts high-salience sentences from retrieved contexts, scores them against
    the user's research query, and formats a structured academic synthesis with citations.
    Ensures the user gets a well-structured answer even when Ollama is offline or crashes.
    """
    if not contexts:
        return (
            "⚠️ **No matching documents found in local knowledge base.**\n\n"
            "Please ensure relevant documents (PDF, DOCX, TXT) are indexed via **Library > Scan & Organize**."
        )

    # Clean query keywords
    keywords = set()
    if query:
        clean_q = re.sub(r'[^\w\s]', ' ', str(query).lower())
        stopwords = {"what", "is", "the", "a", "an", "and", "or", "in", "of", "for", "with", "to", "how", "does", "explain", "describe", "tell", "me", "about"}
        keywords = {w for w in clean_q.split() if len(w) > 2 and w not in stopwords}

    # Extract and score candidate sentences across contexts
    scored_sentences = []
    seen_texts = set()

    for idx, c in enumerate(contexts):
        raw_text = c.get('text', '') if isinstance(c, dict) else str(c)
        fname = "Unknown"
        if isinstance(c, dict) and c.get('file'):
            fname = c['file'][0] if isinstance(c['file'], (list, tuple)) and len(c['file']) > 0 else str(c['file'])

        # Split into clean sentences
        sentences = re.split(r'(?<=[.!?])\s+', raw_text)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) < 25 or len(s_clean) > 400:
                continue
            normalized = re.sub(r'\s+', ' ', s_clean.lower())
            if normalized in seen_texts:
                continue
            seen_texts.add(normalized)

            # Score sentence: query keyword matches + position weight + chunk rank weight
            score = 0.0
            s_words = set(re.findall(r'\b\w+\b', normalized))
            if keywords:
                overlap = s_words.intersection(keywords)
                score += len(overlap) * 3.0
            score += max(0.5, 2.0 - (idx * 0.4))

            scored_sentences.append({
                "sentence": s_clean,
                "score": score,
                "source": fname
            })

    # Sort descending by relevance score
    scored_sentences.sort(key=lambda x: x["score"], reverse=True)
    top_findings = scored_sentences[:5]

    output_lines = [
        "> ℹ️ **Offline Direct Extractive Mode (Deterministic RAG)**",
        "> *Local neural generative model (Ollama) is currently unreachable. AuraSync LM synthesized key findings directly from your indexed documents.*",
        "",
        "### 📌 Key Extracted Findings",
        ""
    ]

    if top_findings:
        for item in top_findings:
            output_lines.append(f"- {item['sentence']} **[Source: {item['source']}]**")
    else:
        for c in contexts[:3]:
            fname = c.get('file', ['Unknown'])[0] if isinstance(c, dict) and c.get('file') else "Document"
            snippet = c.get('text', '')[:300].strip()
            output_lines.append(f"- **[{fname}]**: {snippet}...")

    output_lines.extend([
        "",
        "### 📑 Cited Source Excerpts",
        ""
    ])

    for i, c in enumerate(contexts[:3]):
        fname = c.get('file', ['Unknown'])[0] if isinstance(c, dict) and c.get('file') else f"Source {i+1}"
        domain = c.get('file', ['', '', ''])[2] if isinstance(c, dict) and isinstance(c.get('file'), (list, tuple)) and len(c['file']) > 2 else ""
        snippet = (c.get('text', '')[:400] + "...") if len(c.get('text', '')) > 400 else c.get('text', '')
        tag = f" ({domain})" if domain else ""
        output_lines.append(f"**Source {i+1}: [{fname}]{tag}**")
        output_lines.append(f"> {snippet.strip()}")
        output_lines.append("")

    output_lines.extend([
        "---",
        "💡 *To re-enable neural generative answers with follow-ups, launch Ollama (`ollama serve`) and ensure `llama3.2` or `llama3` is installed.*"
    ])

    return "\n".join(output_lines)

# =========================
# EMBEDDING
# =========================
def get_embedding(text):
    """Get embedding matching ChromaDB index dimension (384-dim SentenceTransformer)."""
    # Use the same local model that built the Chroma index (all-MiniLM-L6-v2, 384 dimensions)
    try:
        from models import get_models
        model, _ = get_models()
        if model is not None:
            return model.encode(text).tolist()
    except Exception as e:
        logger.error(f"Local SentenceTransformer embedding failed: {e}")

    # Fallback to Ollama only if local model failed and embedding matches 384-dim
    status = get_ollama_status()
    if status["active"]:
        try:
            import ollama
            client = ollama.Client(host='http://127.0.0.1:11434')
            for model_name in ['all-minilm', 'nomic-embed-text']:
                try:
                    resp = client.embeddings(model=model_name, prompt=text[:8000])
                    emb = resp.get('embedding', [])
                    if len(emb) == 384:
                        return emb
                except:
                    continue
        except:
            pass

    return None

# =========================
# SEMANTIC RETRIEVAL
# =========================
_CHROMA_CLIENTS = {}

def get_chroma_client(chroma_dir):
    import chromadb
    if chroma_dir not in _CHROMA_CLIENTS:
        _CHROMA_CLIENTS[chroma_dir] = chromadb.PersistentClient(path=chroma_dir)
    return _CHROMA_CLIENTS[chroma_dir]

def retrieve(query, user_id="default", top_k=3):
    """Retrieve top-k relevant chunks for the specific user using ChromaDB."""
    try:
        from main import get_user_paths
        
        user_paths = get_user_paths(user_id)
        chroma_dir = os.path.join(user_paths["data_dir"], "chroma_db")
        
        if not os.path.exists(chroma_dir):
            return []
            
        client = get_chroma_client(chroma_dir)
        try:
            collection = client.get_collection(name="rag_collection")
        except:
            return []

        query_emb = get_embedding(query)
        if query_emb is None:
            return []

        # Query ChromaDB
        results = collection.query(
            query_embeddings=[query_emb],
            n_results=top_k
        )

        if not results["documents"] or not results["documents"][0]:
            return []

        formatted_results = []
        # ChromaDB returns a list of lists for queries
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if "distances" in results and results["distances"] else [0] * len(docs)
        chunk_ids = results["ids"][0] if "ids" in results and results["ids"] else [f"chunk_{i}" for i in range(len(docs))]

        for cid, doc, meta, dist in zip(chunk_ids, docs, metas, distances):
            # Convert chroma distance to a pseudo-similarity score (Chroma uses L2 by default, smaller is better)
            # For simplicity, we just invert it or use a default score.
            score = 1.0 / (1.0 + dist)
            # Format file tuple as expected by older code (name, path, domain, topic, subtopic)
            file_tuple = (meta.get("name", "Unknown"), meta.get("path", ""), meta.get("domain", ""), meta.get("topic", ""), meta.get("subtopic", ""))
            formatted_results.append({
                "id": cid,
                "text": doc,
                "file": file_tuple,
                "score": score
            })
            
        return formatted_results
    except Exception as e:
        logger.error(f"ChromaDB retrieval failed: {e}")
        return []

def mmlf_retrieve(query, user_id="default", top_k=3, progress_callback=None, request_id=None):
    """
    Retrieve top-k relevant chunks using the NAACL 2025 MMLF Pipeline:
    MQR (Multi-Query) -> CQE (Pseudo-Passage) -> 4x Dense Queries -> RRF Fusion (k=60).
    Falls back gracefully to standard retrieve() if MMLF encounters any error.
    """
    try:
        from mmlf_engine import run_mmlf_pipeline
        
        def local_retriever(q_text, k):
            return retrieve(q_text, user_id=user_id, top_k=k)
            
        result = run_mmlf_pipeline(
            query=query,
            retriever_func=local_retriever,
            top_k=top_k,
            progress_callback=progress_callback,
            request_id=request_id
        )
        return result
    except Exception as e:
        logger.error(f"MMLF retrieval fallback to standard retrieval: {e}")
        standard_results = retrieve(query, user_id=user_id, top_k=top_k)
        return {
            "query": query,
            "subqueries": [query],
            "pseudo_documents": [],
            "contexts": standard_results,
            "method": "Standard Dense Retrieval (Fallback)"
        }

# =========================
# SMART MODE DETECTION
# =========================
def detect_mode(query):
    q = query.lower()
    if any(w in q for w in ["summarize", "summary", "overview", "brief"]):
        return "summary"
    elif any(w in q for w in ["quiz", "test me", "questions", "mcq"]):
        return "quiz"
    elif any(w in q for w in ["explain", "how does", "what is", "define", "tutorial"]):
        return "explain"
    elif any(w in q for w in ["compare", "difference", "vs ", "versus"]):
        return "compare"
    elif any(w in q for w in ["list", "enumerate", "what are"]):
        return "list"
    elif any(w in q for w in ["hello", "hi ", "hey", "greeting", "how are you", "what's up"]):
        return "greeting"
    else:
        return "research"

MODE_INSTRUCTIONS = {
    "summary": "Provide a clear, structured SUMMARY with key points as bullet list.",
    "quiz": "Generate 5 well-formed MCQ questions with answers based on the context.",
    "explain": "Explain step-by-step, with examples, in clear simple language.",
    "compare": "Create a structured comparison table and explain key differences.",
    "list": "Provide a well-organized numbered or bulleted list.",
    "research": "Provide a comprehensive, expert-level research synthesis with sections.",
    "greeting": "Provide a warm, professional greeting as AuraSync Intelligence.",
}
mode_instructions = MODE_INSTRUCTIONS

_ANSWER_CACHE = {}

def clear_answer_cache():
    """Clear in-memory answer cache."""
    global _ANSWER_CACHE
    _ANSWER_CACHE.clear()

def generate_answer(query, contexts_json_str, history_json_str="[]", request_id=None, pipeline_stats=None, use_answer_cache=False):
    """
    Generate a structured, expert-level answer using local Ollama model.
    Powered by RAG context from local documents only.
    Reconciles decomposed LLM call counts (MQR + CQE + Answer) and timings.
    """
    import time
    import uuid
    req_id = request_id or f"req_{uuid.uuid4().hex[:8]}"

    # Check Tier 2 Answer Cache if enabled
    cache_key = f"{query}|||{contexts_json_str}"
    if use_answer_cache and cache_key in _ANSWER_CACHE:
        cached_ans, cached_dur_ms = _ANSWER_CACHE[cache_key]
        logger.info(f"[STAGE 6/6] Final answer cache HIT\n  cache=answer_cache status=instant duration_ms={cached_dur_ms:.1f} llm_calls=0")
        logger.info(f"[INFO] request_id={req_id} summary:\n  status=success cache_tier=answer_cache duration_ms={cached_dur_ms:.1f} total_llm_calls=0")
        return cached_ans

    status = get_ollama_status()
    if not status["active"]:
        if contexts_json_str and contexts_json_str != "[]":
            contexts = json.loads(contexts_json_str) if isinstance(contexts_json_str, str) else contexts_json_str
            return generate_offline_answer(contexts, query=query)
        return f"⚠️ {status['message']}"

    contexts = json.loads(contexts_json_str) if isinstance(contexts_json_str, str) else contexts_json_str
    history = json.loads(history_json_str) if isinstance(history_json_str, str) else history_json_str
    mode = detect_mode(query)

    # Skip context for greetings
    if mode == "greeting":
        contexts = []

    # Format context with source citations
    context_text = ""
    for i, c in enumerate(contexts):
        fname = c['file'][0] if c['file'] else "Unknown"
        domain = c['file'][2] if len(c['file']) > 2 else ""
        topic = c['file'][3] if len(c['file']) > 3 else ""
        context_text += f"\n--- Source {i+1}: [{fname}] ({domain} > {topic}) ---\n{c['text']}\n"

    # ── Out-of-Domain Relevance Gate (T6 fix) ──────────────────────────────
    # ChromaDB always returns the top-k closest chunks even if they are completely
    # unrelated to the query (no null-result mode). If the best similarity score
    # across ALL returned chunks is below this threshold the context is semantically
    # irrelevant — treat it the same as MISSING so the ⚠️ disclaimer fires.
    OUT_OF_DOMAIN_THRESHOLD = 0.58  # cosine/L2-derived pseudo-similarity threshold (~0.58 separates out-of-domain)
    max_ctx_score = 0.0
    if contexts:
        max_ctx_score = max(
            float(c.get("vector_score") or c.get("score") or 0.0)
            for c in contexts
        )

    # Decide whether the retrieved context is actually relevant
    context_relevant = bool(contexts) and (max_ctx_score >= OUT_OF_DOMAIN_THRESHOLD)
    context_status = "FOUND" if context_relevant else "MISSING"
    if contexts and not context_relevant:
        logger.warning(
            f"[WARN] request_id={req_id} out_of_domain_detected: "
            f"max_ctx_score={max_ctx_score:.4f} < threshold={OUT_OF_DOMAIN_THRESHOLD} — "
            f"treating as MISSING context to trigger ⚠️ disclaimer"
        )
        context_text = ""  # Clear so model cannot mine it for a confident-sounding answer
        contexts = []      # Clear context list so prompt treats context as empty and triggers Rule 1

    mode_instructions = {
        "summary": "Provide a clear, structured SUMMARY with key points as bullet list.",
        "quiz": "Generate 5 well-formed MCQ questions with answers based on the context.",
        "explain": "Explain step-by-step, with examples, in clear simple language.",
        "compare": "Create a structured comparison table and explain key differences.",
        "list": "Provide a well-organized numbered or bulleted list.",
        "research": "Provide a comprehensive, expert-level research synthesis with sections.",
        "greeting": "Provide a warm, professional greeting as AuraSync Intelligence.",
    }

    system_prompt = f"""You are AuraSync Intelligence — a premium offline research assistant.
    
YOUR RESEARCH CONTEXT: 
{context_text if contexts else "[EMPTY - NO RELEVANT DOCUMENTS FOUND]"}

MISSION: {mode_instructions.get(mode, mode_instructions["research"])}

STRICT RULES:
1. IF CONTEXT IS EMPTY AND MODE IS NOT GREETING: Start your response with: "⚠️ No relevant topic found in my knowledge base. Based on general knowledge..."
2. IF MODE IS GREETING: Ignore the context and provide a warm, helpful greeting as AuraSync Intelligence.
3. IF CONTEXT IS FOUND: Prioritize it and cite like: (Source: filename.pdf).
3. FORMATTING: Use professional Markdown. Headers, **bold**, and tables for complex data.
4. INTELLIGENT SOURCES: When citing, use the format **[Source: Filename]** at the end of the sentence or paragraph.
5. PROMPT ENGINEERING: If the user provides a structured prompt with specific constraints (e.g., "format as a table", "use exactly 5 bullet points", "write in the style of X"), prioritize these specific instructions over the default MISSION to provide a perfectly tuned response.

{ "Try these related questions to expand your knowledge:" if context_status == "MISSING" else "End every response with:" }
---FOLLOW_UPS---
1. [Question 1]
2. [Question 2]
3. [Question 3]"""

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 6 turns = 3 user + 3 assistant)
    for turn in history[-6:]:
        if isinstance(turn, dict) and 'role' in turn and 'content' in turn:
            messages.append({"role": turn["role"], "content": turn["content"]})

    messages.append({"role": "user", "content": query})

    try:
        import ollama
        client = ollama.Client(host='http://127.0.0.1:11434')

        # Try models in order of preference
        model_candidates = ['llama3.2:latest', 'llama3.1:latest', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi']
        for model in model_candidates:
            try:
                client.show(model)
                t_s6_start = time.perf_counter()
                response = client.chat(model=model, messages=messages, options={'num_ctx': 4096})
                s6_dur_ms = (time.perf_counter() - t_s6_start) * 1000.0
                ctx_ids = [c.get('id') or (c['file'][0] if c.get('file') else f'chunk_{i+1}') for i, c in enumerate(contexts[:4])]
                logger.info(f"[STAGE 6/6] Final answer generation\n  model={model} context_chunk_ids={ctx_ids}\n  duration_ms={s6_dur_ms:.1f}")

                final_content = response['message']['content']
                if context_status == "MISSING" and mode != "greeting":
                    if not final_content.lstrip().startswith("⚠️"):
                        final_content = "⚠️ No relevant topic found in my knowledge base. Based on general knowledge:\n\n" + final_content

                # Save to answer cache if requested
                if use_answer_cache:
                    _ANSWER_CACHE[cache_key] = (final_content, round(s6_dur_ms, 1))

                # Comprehensive request summary reconciling all LLM stages
                if pipeline_stats:
                    mqr_calls = pipeline_stats.get("llm_calls_mqr", 0)
                    cqe_calls = pipeline_stats.get("llm_calls_cqe", 0)
                    pipe_latency = pipeline_stats.get("latency_ms", 0.0)
                    total_llm = mqr_calls + cqe_calls + 1
                    wallclock_ms = pipe_latency + s6_dur_ms
                    logger.info(
                        f"[INFO] request_id={req_id} summary:\n"
                        f"  status=success total_wallclock_ms={wallclock_ms:.1f}\n"
                        f"  llm_calls: subquery={mqr_calls} passage={cqe_calls} answer=1 total={total_llm}\n"
                        f"  durations_ms: retrieval_pipeline={pipe_latency:.1f} answer_generation={s6_dur_ms:.1f}"
                    )
                else:
                    logger.info(
                        f"[INFO] request_id={req_id} summary:\n"
                        f"  status=success stage=answer_generation_only duration_ms={s6_dur_ms:.1f} answer_llm_calls=1"
                    )
                return final_content
            except:
                continue
        logger.info(f"[INFO] request_id={req_id} status=error\n  total_duration_ms=0.0 llm_calls=0 error=\"No supported Ollama model found\"")
        return "No Ollama model found. Run: ollama pull llama3"
    except Exception as e:
        logger.error(f"[INFO] request_id={req_id} status=error\n  total_duration_ms=0.0 error=\"{str(e)}\"")
        return f"Intelligence Error: {str(e)}"


# =========================
# ASYNC STREAM GENERATOR
# =========================
async def stream_answer(query, contexts, history):
    """
    Async generator that streams tokens from Ollama for ChatGPT-like experience.
    Provides graceful offline fallback if Ollama is unreachable or encounters connection errors.
    """
    status = get_ollama_status()
    if not status["active"]:
        offline_text = generate_offline_answer(contexts, query=query)
        chunk_size = 6
        words = offline_text.split(" ")
        for i in range(0, len(words), chunk_size):
            yield " ".join(words[i:i+chunk_size]) + (" " if i + chunk_size < len(words) else "")
            await asyncio.sleep(0.015)
        return

    context_text = ""
    for i, c in enumerate(contexts[:3]):
        fname = c['file'][0] if c['file'] else "Unknown"
        domain = c['file'][2] if len(c['file']) > 2 else ""
        topic = c['file'][3] if len(c['file']) > 3 else ""
        snippet = c['text'][:1000] + "..." if len(c['text']) > 1000 else c['text']
        context_text += f"\n--- Source {i+1}: [{fname}] ({domain} > {topic}) ---\n{snippet}\n"

    mode = detect_mode(query)
    mode_instructions = {
        "summary": "Provide a clear, structured SUMMARY with key points as bullet list.",
        "quiz": "Generate 5 well-formed MCQ questions with answers based on the context.",
        "explain": "Explain step-by-step, with examples, in clear simple language.",
        "compare": "Create a structured comparison table and explain key differences.",
        "list": "Provide a well-organized numbered or bulleted list.",
        "research": "Provide a comprehensive, expert-level research synthesis with sections.",
        "greeting": "Provide a warm, professional greeting as AuraSync Intelligence. Explicitly state that you draw your knowledge only from the user's local files and supported research formats (PDF, DOCX, TXT, etc.). Invite the user to ask about their documents or any other queries."
    }

    # Handle No Context Case
    context_status = "FOUND" if contexts else "MISSING"

    system_prompt = f"""You are AuraSync Intelligence — a premium offline research assistant.
    
YOUR RESEARCH CONTEXT: 
{context_text if contexts else "[EMPTY - NO RELEVANT DOCUMENTS FOUND]"}

MISSION: {mode_instructions.get(mode, mode_instructions["research"])}

STRICT RULES:
1. IF CONTEXT IS EMPTY AND MODE IS NOT GREETING: Start your response with: "⚠️ No relevant topic found in my knowledge base. Based on general knowledge..."
2. IF MODE IS GREETING: Ignore the context and provide a warm, helpful greeting as AuraSync Intelligence.
3. IF CONTEXT IS FOUND: Prioritize it and cite like: (Source: filename.pdf).
3. FORMATTING: Use professional Markdown. Headers, **bold**, and tables for complex data.
4. INTELLIGENT SOURCES: When citing, use the format **[Source: Filename]** at the end of the sentence or paragraph.
5. PROMPT ENGINEERING: If the user provides a structured prompt with specific constraints (e.g., "format as a table", "limit to 100 words", "use a scientific tone"), prioritize these specific instructions over the default MISSION to provide a perfectly tuned and accurate response.

{ "Try these related questions to expand your knowledge:" if context_status == "MISSING" else "End every response with:" }
---FOLLOW_UPS---
1. [Question 1]
2. [Question 2]
3. [Question 3]"""

    messages = [{"role": "system", "content": system_prompt}]
    for turn in history[-6:]:
        if isinstance(turn, dict) and 'role' in turn and 'content' in turn:
            messages.append(turn)
    messages.append({"role": "user", "content": query})

    try:
        import ollama
        client = ollama.AsyncClient(host='http://127.0.0.1:11434')

        model = 'llama3.2:latest'
        model_candidates = ['llama3.2:latest', 'llama3.1:latest', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'phi']
        for m in model_candidates:
            try:
                sync_client = ollama.Client(host='http://127.0.0.1:11434')
                sync_client.show(m)
                model = m
                break
            except Exception:
                continue

        logger.info(f"[STAGE 6/6] Final answer grounded in contexts: Streaming response with model '{model}' grounded in {len(contexts)} retrieved context(s)")

        async for chunk in await client.chat(model=model, messages=messages, stream=True, options={'num_ctx': 4096}):
            token = chunk.get('message', {}).get('content', '')
            if token:
                yield token
    except Exception as e:
        logger.warning(f"Ollama stream error: {e}. Gracefully falling back to intelligent extractive answer.")
        yield f"\n\n> ⚠️ *Local LLM connection unavailable ({str(e)}). Seamlessly switching to offline extractive mode...*\n\n"
        offline_text = generate_offline_answer(contexts, query=query)
        chunk_size = 6
        words = offline_text.split(" ")
        for i in range(0, len(words), chunk_size):
            yield " ".join(words[i:i+chunk_size]) + (" " if i + chunk_size < len(words) else "")
            await asyncio.sleep(0.015)
