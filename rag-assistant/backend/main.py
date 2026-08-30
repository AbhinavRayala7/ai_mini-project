import os
import json
import sqlite3
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="Enterprise RAG Knowledge Assistant Backend")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Initialization
DB_PATH = "rag_knowledge.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            upload_time DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER,
            content TEXT,
            embedding TEXT,  -- JSON string of list
            FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Helper Functions
def get_gemini_client(api_key: Optional[str] = None):
    # Try getting key from parameter, then environment
    key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise HTTPException(
            status_code=401, 
            detail="Gemini API Key missing. Please provide it in the API-Key header or set environment variables."
        )
    genai.configure(api_key=key)
    return genai

def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))

def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 200) -> List[str]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - chunk_overlap
    return chunks

# Pydantic Schemas
class QueryRequest(BaseModel):
    query: str
    api_key: Optional[str] = None

class DocumentResponse(BaseModel):
    id: int
    filename: str

class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]

@app.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    x_api_key: Optional[str] = Header(None)
):
    actual_key = api_key or x_api_key
    client = get_gemini_client(actual_key)
    
    # Read content
    contents = await file.read()
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Only UTF-8 encoded text/markdown files are supported in this version.")

    # Insert Document
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO documents (filename) VALUES (?)", (file.filename,))
        document_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # Document already exists, delete old chunks and re-insert
        cursor.execute("SELECT id FROM documents WHERE filename = ?", (file.filename,))
        document_id = cursor.fetchone()[0]
        cursor.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
    
    # Chunking
    chunks = chunk_text(text)
    if not chunks:
        conn.close()
        raise HTTPException(status_code=400, detail="Document contains no readable text.")

    # Embed chunks using Gemini API
    try:
        response = client.embed_content(
            model="models/gemini-embedding-001",
            content=chunks,
            task_type="retrieval_document"
        )
        embeddings = response['embedding']
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Gemini Embedding failed: {str(e)}")

    # Store chunks
    for chunk, embedding in zip(chunks, embeddings):
        cursor.execute(
            "INSERT INTO chunks (document_id, content, embedding) VALUES (?, ?, ?)",
            (document_id, chunk, json.dumps(embedding))
        )
    
    conn.commit()
    conn.close()
    
    return {"id": document_id, "filename": file.filename}

@app.get("/documents", response_model=List[DocumentResponse])
async def list_documents():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename FROM documents")
    docs = [{"id": row[0], "filename": row[1]} for row in cursor.fetchall()]
    conn.close()
    return docs

@app.delete("/documents/{document_id}")
async def delete_document(document_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Document and associated vector chunks deleted."}

@app.post("/query", response_model=QueryResponse)
async def query_knowledge_base(
    request: QueryRequest,
    x_api_key: Optional[str] = Header(None)
):
    actual_key = request.api_key or x_api_key
    client = get_gemini_client(actual_key)

    # Embed query
    try:
        response = client.embed_content(
            model="models/gemini-embedding-001",
            content=request.query,
            task_type="retrieval_query"
        )
        query_embedding = response['embedding']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini query embedding failed: {str(e)}")

    # Fetch all chunks and documents
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT chunks.content, chunks.embedding, documents.filename 
        FROM chunks 
        JOIN documents ON chunks.document_id = documents.id
    """)
    all_chunks = cursor.fetchall()
    conn.close()

    if not all_chunks:
        raise HTTPException(status_code=400, detail="No documents uploaded yet. Please upload a document first.")

    # Calculate similarity
    scored_chunks = []
    for content, emb_str, filename in all_chunks:
        emb = json.loads(emb_str)
        sim = cosine_similarity(query_embedding, emb)
        scored_chunks.append((sim, content, filename))

    # Sort and take top 4
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored_chunks[:4]

    # Build context and prompt
    context = "\n---\n".join([f"Source: {filename}\nContent: {content}" for sim, content, filename in top_chunks])
    
    prompt = f"""You are a professional Enterprise Knowledge Assistant. Answer the user's question accurately using ONLY the provided context blocks. 
If the context does not contain the answer, explain that you cannot find the information in the documents. Do not make up answers.

Context blocks:
{context}

Question: {request.query}

Answer:"""

    try:
        model = client.GenerativeModel("gemini-3.6-flash")
        generation = model.generate_content(prompt)
        answer = generation.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini text generation failed: {str(e)}")

    sources = [{"filename": filename, "content": content, "score": score} for score, content, filename in top_chunks]
    
    return {"answer": answer, "sources": sources}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
