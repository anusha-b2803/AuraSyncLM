# AuraSync LM - Local-First AI Knowledge Engine

A powerful, privacy-first desktop application that indexes local files into a semantic knowledge base with Retrieval-Augmented Generation (RAG) powered by local LLMs via Ollama.

---

## 🚀 Key Features

- **Local RAG & Semantic Search**: Retrieval-Augmented Generation using Sentence Transformers and ChromaDB vector indexing.
- **Offline LLM Inference**: Fully compatible with Ollama (Llama 3, Mistral, etc.) with air-gapped privacy—data never leaves your machine.
- **Adaptive Multi-Modal Learning Framework (MMLF)**: Intelligent indexing, quantization, caching, and document classification.
- **Modern Desktop UI**: React, Tailwind CSS, Vite, and Electron with light, dark, and AMOLED themes.
- **Zero-Trust Security**: Dynamic port allocation and token-secured internal communication between frontend and backend.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python 3.10+, PyMuPDF, ChromaDB, Sentence-Transformers, KeyBERT, Ollama
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Supabase (optional auth/sync)
- **Desktop**: Electron

---

## ⚡ Quick Start (Windows)

### Automated Setup
Double-click `setup.bat` or run:
```bat
setup.bat
```
This script will:
1. Check for Ollama (downloads and installs if missing)
2. Pull the default `llama3` model
3. Install Python backend requirements
4. Install Node.js frontend dependencies

### Launching the Application
Run:
```bat
run.bat
```

---

## 🔧 Manual Setup

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **Ollama** installed and running:
  ```bash
  ollama pull llama3
  ```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows (or source venv/bin/activate on Unix)
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
cp .env.example .env   # Configure Supabase or leave defaults for local mode
npm install
```

### 4. Running in Development
Start backend:
```bash
cd backend
python api.py
```

Start frontend / desktop:
```bash
cd frontend
npm run dev
# Or for Electron desktop:
npm run electron:dev
```

---

## 📁 Repository Structure

```text
aurasync/
├── backend/                  # FastAPI local core & RAG engine
│   ├── routers/              # Modular API endpoints (chat, search, auth, system)
│   ├── services/             # MMLF and background services
│   ├── api.py                # Core FastAPI server entry point
│   ├── chatbot.py            # RAG pipeline & LLM interaction logic
│   ├── mmlf_engine.py        # Adaptive indexing & search engine
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + Vite + Electron desktop application
│   ├── src/                  # Components, contexts, hooks, styles
│   ├── electron/             # Electron main & preload scripts
│   ├── package.json          # Frontend dependencies & scripts
│   └── .env.example          # Sample environment configuration
├── setup.bat                 # Automated Windows environment setup
├── run.bat                   # App launcher
└── .gitignore                # Git ignore rules for node_modules, caches, and secrets
```

---

## 🔒 Security & Privacy

- All sensitive credentials and local files should be placed in `.env` (ignored by git).
- Large binary artifacts, database checkpoints, and model weights are excluded via `.gitignore`.
- See `frontend/.env.example` for environment variable templates.

