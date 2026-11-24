import pickle
from models import get_models

CHUNK_SIZE = 200

def chunk_text(text, chunk_size=300, overlap=50):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        if i + chunk_size >= len(words):
            break
    return chunks

def build_index(texts, file_info, index_path="rag_index.pkl"):
    print("Building RAG index...")
    model, _ = get_models()
    
    data = []

    for i, text in enumerate(texts):
        chunks = chunk_text(text)

        for chunk in chunks:
            emb = model.encode(chunk)

            data.append({
                "text": chunk,
                "embedding": emb,
                "file": file_info[i]
            })

    with open(index_path, "wb") as f:
        pickle.dump(data, f)

    print("[OK] RAG index built successfully!")