# AuraSync LM - Production-Ready AI Workspace

A powerful, privacy-first desktop application that transforms your local files into a searchable knowledge base using Local Language Models (LLMs).

## 🚀 Features

### 🧠 Neural Intelligence (RAG)
- **Real Local RAG**: Fully functional Retrieval-Augmented Generation using your own documents.
- **ChromaDB Integration**: High-performance vector database for instant semantic search across thousands of pages.
- **Ollama Integration**: Supports Llama 3, Mistral, and other local models for 100% offline intelligence.
- **Smart Classification**: AI-powered clustering that automatically organizes your files into Domains, Topics, and Subtopics.

### 🛡️ Production-Grade Security
- **Dynamic Port Allocation**: Automatically finds free ports to prevent system conflicts.
- **Zero-Trust Token System**: All internal communications between Electron and Python are secured with dynamic 32-character tokens.
- **Air-Gapped Privacy**: Your data never leaves your machine. Optional "Continue Offline" mode bypasses all cloud dependencies.

### 📂 Advanced Library Management
- **Zero-Copy Organization**: Organizes your research without duplicating files, saving gigabytes of disk space.
- **Cross-Drive Scanning**: Automatically detects and indexes research from all connected drives.
- **Virtual Structure**: Instant library loading via metadata-driven virtual folders.

### 🎨 Premium Aesthetics
- **Modern UI**: Built with Framer Motion and custom Glassmorphism panels.
- **Adaptive Themes**: Light, Dark, and AMOLED modes with fluid transitions.

## 📦 Tech Stack

- **Frontend**: React + Vite + Framer Motion
- **Desktop**: Electron
- **Backend**: FastAPI (Python)
- **Database**: ChromaDB (Vector)
- **AI**: Ollama (Inference)

## 🛠️ Installation & Setup

1. **Install Ollama**: Download from [ollama.com](https://ollama.com).
2. **Install Dependencies**:
   ```bash
   # Frontend
   cd frontend && npm install
   # Backend
   cd ../backend && pip install -r requirements.txt
   ```
3. **Run for Development**:
   ```bash
   # In the root directory
   npm run dev:electron
   ```

## 🎯 Production Build

To package the application for distribution:

1. **Package Backend**:
   ```bash
   python backend/package_backend.py
   ```
2. **Package Electron**:
   ```bash
   npm run electron:build
   ```

---

**Note**: AuraSync LM is now a fully functional production-level application. All AI, NLP, and file processing features are active and run locally on your hardware.
