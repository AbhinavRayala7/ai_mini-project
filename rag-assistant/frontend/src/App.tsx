import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Send, 
  Trash2, 
  FileText, 
  BookOpen, 
  AlertCircle, 
  Loader2, 
  Key, 
  Layers 
} from "lucide-react";
import "./App.css";

interface Document {
  id: number;
  filename: string;
}

interface Source {
  filename: string;
  content: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const BACKEND_URL = "http://127.0.0.1:8000";

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I am your Enterprise Knowledge Assistant. Upload reference documents and start asking questions."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Source[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  const handleApiKeySave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("gemini_api_key", apiKey);
    setShowKeyInput(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading & embedding document...");

    const formData = new FormData();
    formData.append("file", file);
    if (apiKey) {
      formData.append("api_key", apiKey);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadStatus("Success! Document indexed.");
        fetchDocuments();
        setTimeout(() => setUploadStatus(null), 3000);
      } else {
        const errData = await res.json();
        setUploadStatus(`Error: ${errData.detail || "Upload failed"}`);
      }
    } catch (err) {
      setUploadStatus("Connection to backend failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDocument = async (id: number) => {
    try {
      const res = await fetch(`${BACKEND_URL}/documents/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDocuments();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "X-API-Key": apiKey })
        },
        body: JSON.stringify({ query: userMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.answer,
          sources: data.sources 
        }]);
        // Auto-show sources for the latest message
        if (data.sources && data.sources.length > 0) {
          setSelectedSources(data.sources);
        }
      } else {
        const errData = await res.json();
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Error: ${errData.detail || "Failed to get answer."}` 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Error: Could not connect to the backend server. Please verify it is running." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header Navigation */}
      <header className="app-header glass-panel">
        <div className="header-logo">
          <Layers className="logo-icon animate-pulse" />
          <h1>DocuMind <span className="badge">RAG AI</span></h1>
        </div>
        
        <div className="header-actions">
          <button 
            className={`btn-secondary api-key-btn ${apiKey ? "key-saved" : ""}`}
            onClick={() => setShowKeyInput(!showKeyInput)}
          >
            <Key size={16} />
            {apiKey ? "API Key Set" : "Configure API Key"}
          </button>
          
          <a 
            href="https://github.com/AbhinavRayala7" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-link"
          >
            <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </div>
      </header>

      {/* API Key Modal Panel */}
      {showKeyInput && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel animate-fade-in">
            <h3>Configure Google Gemini API Key</h3>
            <p>Your API key is stored locally in your browser and used only to process your requests.</p>
            <form onSubmit={handleApiKeySave} className="api-key-form">
              <input 
                type="password" 
                placeholder="Enter Gemini API Key (e.g. AIzaSy...)" 
                className="glass-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <div className="modal-buttons">
                <button type="button" className="btn-secondary" onClick={() => setShowKeyInput(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Key</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Grid Workspace */}
      <main className="workspace-grid">
        {/* Left Side Panel - Document Console */}
        <section className="side-panel left-panel glass-panel">
          <div className="section-title">
            <Upload size={18} />
            <h2>Document Hub</h2>
          </div>

          {/* Drag & Drop Upload Container */}
          <div 
            className={`upload-dropzone ${isUploading ? 'uploading' : ''}`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="upload-icon animate-spin" size={32} />
            ) : (
              <Upload className="upload-icon" size={32} />
            )}
            <p className="upload-prompt">
              {isUploading ? "Uploading..." : "Click to browse files"}
            </p>
            <span className="upload-subtitle">Supports TXT, MD, PDF (UTF-8 text)</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden-file-input" 
              accept=".txt,.md,.json,.csv,.pdf"
              disabled={isUploading}
              onChange={handleFileUpload} 
            />
          </div>

          {uploadStatus && (
            <div className={`status-banner ${uploadStatus.includes("Error") ? "status-error" : "status-success"}`}>
              <AlertCircle size={14} />
              <span>{uploadStatus}</span>
            </div>
          )}

          {/* Document Inventory List */}
          <div className="document-list-container">
            <h3>Knowledge Sources ({documents.length})</h3>
            {documents.length === 0 ? (
              <div className="empty-state">
                <FileText size={28} />
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="document-list">
                {documents.map((doc) => (
                  <div key={doc.id} className="document-item">
                    <FileText size={16} className="doc-icon" />
                    <span className="doc-name" title={doc.filename}>{doc.filename}</span>
                    <button 
                      className="delete-doc-btn" 
                      onClick={() => handleDeleteDocument(doc.id)}
                      title="Remove source"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Center Panel - Conversational Assistant */}
        <section className="center-panel glass-panel">
          <div className="chat-messages-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className="avatar">
                  {msg.role === "assistant" ? "AI" : "ME"}
                </div>
                <div className="message-bubble">
                  <div className="message-content">{msg.content}</div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <button 
                      className="view-sources-btn"
                      onClick={() => setSelectedSources(msg.sources || null)}
                    >
                      <BookOpen size={12} />
                      Show Sources ({msg.sources.length})
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row assistant">
                <div className="avatar">AI</div>
                <div className="message-bubble loading-bubble">
                  <Loader2 className="animate-spin" size={18} />
                  <span>Thinking & searching knowledge base...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-bar">
            <input 
              type="text" 
              placeholder="Ask anything about the uploaded documents..." 
              className="glass-input chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" className="btn-primary send-btn" disabled={isLoading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
        </section>

        {/* Right Side Panel - Source Context Explorer */}
        <section className="side-panel right-panel glass-panel">
          <div className="section-title">
            <BookOpen size={18} />
            <h2>Source Inspector</h2>
          </div>

          <div className="sources-container">
            {!selectedSources ? (
              <div className="empty-state">
                <Layers size={28} />
                <p>Click "Show Sources" on any AI response to inspect referenced document chunks.</p>
              </div>
            ) : (
              <div className="sources-list">
                <div className="sources-header">
                  <h3>Retrieved Chunks</h3>
                  <button className="clear-sources-btn" onClick={() => setSelectedSources(null)}>Clear</button>
                </div>
                {selectedSources.map((src, idx) => (
                  <div key={idx} className="source-card glass-panel">
                    <div className="source-card-header">
                      <span className="source-doc-name">{src.filename}</span>
                      <span className="source-score">Match: {(src.score * 100).toFixed(1)}%</span>
                    </div>
                    <p className="source-card-text">"{src.content}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
