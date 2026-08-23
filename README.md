# Mini AI & Operations Engineering Projects

This repository contains two production-aligned mini AI applications showcasing end-to-end full-stack, data science, and AI agent engineering capabilities, built using FastAPI, React, TypeScript, and Google Gemini API.

---

## 🚀 Project 1: Enterprise RAG Knowledge Assistant
An document intelligence chatbot that lets users upload reference documents and query them utilizing a custom Retrieval-Augmented Generation (RAG) pipeline.

### Tech Stack
* **Frontend**: React + TypeScript + custom CSS (premium glassmorphic theme)
* **Backend**: FastAPI (Python)
* **Vector Engine**: SQLite-based custom cosine-similarity vector store (built in pure Python/NumPy to eliminate heavy native C++ binaries)
* **LLM**: Gemini API (`models/text-embedding-004` and `gemini-1.5-flash`)

### Features
* Secure document chunking & ingestion.
* Interactive chat with source reference highlighting and similarity scores.
* Localized browser storage for API Key configuration.

---

## 📊 Project 2: OpsAnalyst Data Agent
An interactive analytics dashboard that turns raw operational data (CSV/Excel) into structured summaries and responsive visualizations.

### Tech Stack
* **Frontend**: React + TypeScript + Recharts
* **Backend**: FastAPI (Python)
* **Data Processing**: Pandas + NumPy
* **LLM**: Gemini API Tool Calling/Code Synthesis

### Features
* Sandbox code-interpreter execution: prompts Gemini to write python data analysis pipelines, executes them locally, and synthesizes visual charts.
* Real-time generation of Bar, Line, and Area charts using SVG-powered Recharts.
* Expandable terminal logs showcasing the generated python script and standard output.

---

## ⚙️ How to Run Locally

### 1. RAG Assistant
```bash
# Start Backend (Port 8000)
cd rag-assistant/backend
pip install fastapi uvicorn google-generativeai python-multipart numpy
python main.py

# Start Frontend (Port 5173)
cd ../frontend
npm install
npm run dev
```

### 2. OpsAnalyst Data Agent
```bash
# Start Backend (Port 8001)
cd sales-analyst/backend
pip install fastapi uvicorn google-generativeai python-multipart pandas openpyxl numpy
python main.py

# Start Frontend (Port 5174)
cd ../frontend
npm install
npm run dev
```
