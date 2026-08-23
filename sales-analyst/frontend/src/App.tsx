import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Send, 
  FileSpreadsheet, 
  TrendingUp, 
  Code, 
  Play, 
  AlertCircle, 
  Loader2, 
  Key, 
  Github, 
  ChevronRight, 
  Layers, 
  Database,
  BarChart4
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LineChart, 
  Line, 
  AreaChart, 
  Area 
} from "recharts";
import "./App.css";

interface DatasetInfo {
  status: string;
  rows?: number;
  columns?: string[];
  preview?: any[];
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  code?: string;
  execution_result?: string;
  chart_data?: ChartDataPoint[];
}

const BACKEND_URL = "http://127.0.0.1:8001";

function App() {
  const [dataset, setDataset] = useState<DatasetInfo>({ status: "empty" });
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem("gemini_api_key") || "");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to the AI Sales & Operations Analyst! Upload an operations CSV or Excel file, and I will write Python Pandas scripts to analyze it and build charts for you."
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChartData, setActiveChartData] = useState<ChartDataPoint[] | null>(null);
  const [activeChartType, setActiveChartType] = useState<"bar" | "line" | "area">("bar");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDatasetInfo();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchDatasetInfo = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/dataset-info`);
      if (res.ok) {
        const data = await res.json();
        setDataset(data);
      }
    } catch (err) {
      console.error("Failed to fetch dataset info", err);
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
    setUploadStatus("Uploading & analyzing dataset schema...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadStatus("Dataset loaded successfully.");
        fetchDatasetInfo();
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userQuery = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "X-API-Key": apiKey })
        },
        body: JSON.stringify({ query: userQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.answer,
          code: data.code,
          execution_result: data.execution_result,
          chart_data: data.chart_data || undefined
        }]);
        
        if (data.chart_data && data.chart_data.length > 0) {
          setActiveChartData(data.chart_data);
          // Try to guess best chart type
          if (data.chart_data.length > 10) {
            setActiveChartType("line");
          } else {
            setActiveChartType("bar");
          }
        }
      } else {
        const errData = await res.json();
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Error: ${errData.detail || "Failed to process query."}` 
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Error: Could not connect to the data agent backend." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header glass-panel">
        <div className="header-logo">
          <TrendingUp className="logo-icon animate-pulse" />
          <h1>OpsAnalyst <span className="badge">Data Agent</span></h1>
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
            <Github size={20} />
          </a>
        </div>
      </header>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <h3>Configure Google Gemini API Key</h3>
            <p>Enter your Gemini API key to allow the agent to write python data pipelines for you.</p>
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

      {/* Grid Layout */}
      <main className="workspace-grid">
        
        {/* Left Panel - Dataset Upload & Schema */}
        <section className="side-panel left-panel glass-panel">
          <div className="section-title">
            <Database size={18} />
            <h2>Data Console</h2>
          </div>

          <div 
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="upload-icon" size={32} />
            <p className="upload-prompt">Load CSV/Excel File</p>
            <span className="upload-subtitle">Drag dataset here to analyze</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden-file-input" 
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload} 
            />
          </div>

          {uploadStatus && (
            <div className={`status-banner ${uploadStatus.includes("Error") ? "status-error" : "status-success"}`}>
              <AlertCircle size={14} />
              <span>{uploadStatus}</span>
            </div>
          )}

          {/* Dataset Schema Info */}
          <div className="dataset-details">
            <h3>Active Schema</h3>
            {dataset.status === "empty" ? (
              <div className="empty-state">
                <FileSpreadsheet size={28} />
                <p>No active dataset loaded.</p>
              </div>
            ) : (
              <div className="schema-info">
                <div className="schema-stat">
                  <span>Total Rows:</span>
                  <strong>{dataset.rows}</strong>
                </div>
                <div className="schema-columns-list">
                  <span>Columns Detected:</span>
                  <div className="column-tags">
                    {dataset.columns?.map((col, idx) => (
                      <span key={idx} className="column-tag">{col}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Center Panel - Conversational Analyst */}
        <section className="center-panel glass-panel">
          <div className="chat-messages-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className="avatar">
                  {msg.role === "assistant" ? "AI" : "ME"}
                </div>
                <div className="message-bubble">
                  <div className="message-content">{msg.content}</div>
                  
                  {/* Python Code execution panel */}
                  {msg.code && (
                    <details className="code-execution-details">
                      <summary className="code-summary-header">
                        <Code size={12} />
                        <span>Generated Python Pipeline</span>
                      </summary>
                      <div className="code-block-wrapper">
                        <pre><code>{msg.code}</code></pre>
                        {msg.execution_result && (
                          <div className="code-output">
                            <span className="output-label">Console Output:</span>
                            <pre><code>{msg.execution_result}</code></pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                  
                  {msg.chart_data && msg.chart_data.length > 0 && (
                    <button 
                      className="view-sources-btn"
                      onClick={() => setActiveChartData(msg.chart_data || null)}
                    >
                      <BarChart4 size={12} />
                      Render Visualization ({msg.chart_data.length} pts)
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
                  <span>Synthesizing python code & executing query...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-bar">
            <input 
              type="text" 
              placeholder="e.g. Plot total sales grouped by store region..." 
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

        {/* Right Panel - Dynamic Visualizer Dashboard */}
        <section className="side-panel right-panel glass-panel">
          <div className="section-title">
            <BarChart4 size={18} />
            <h2>Interactive Visualizer</h2>
          </div>

          <div className="chart-workspace">
            {!activeChartData ? (
              <div className="empty-state chart-empty">
                <TrendingUp size={32} />
                <p>Ask a question like "Plot revenue monthly" to render dynamic data models here.</p>
              </div>
            ) : (
              <div className="active-chart-container">
                <div className="chart-selector">
                  <button 
                    className={`chart-type-btn ${activeChartType === "bar" ? "active" : ""}`}
                    onClick={() => setActiveChartType("bar")}
                  >
                    Bar
                  </button>
                  <button 
                    className={`chart-type-btn ${activeChartType === "line" ? "active" : ""}`}
                    onClick={() => setActiveChartType("line")}
                  >
                    Line
                  </button>
                  <button 
                    className={`chart-type-btn ${activeChartType === "area" ? "active" : ""}`}
                    onClick={() => setActiveChartType("area")}
                  >
                    Area
                  </button>
                </div>

                <div className="chart-render-box">
                  <ResponsiveContainer width="100%" height={260}>
                    {activeChartType === "bar" ? (
                      <BarChart data={activeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222A3F" />
                        <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#111625", borderColor: "#222A3F" }} />
                        <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    ) : activeChartType === "line" ? (
                      <LineChart data={activeChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222A3F" />
                        <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#111625", borderColor: "#222A3F" }} />
                        <Line type="monotone" dataKey="value" stroke="#06B6D4" strokeWidth={3} activeDot={{ r: 6 }} />
                      </LineChart>
                    ) : (
                      <AreaChart data={activeChartData}>
                        <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222A3F" />
                        <XAxis dataKey="label" stroke="#9CA3AF" fontSize={11} />
                        <YAxis stroke="#9CA3AF" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: "#111625", borderColor: "#222A3F" }} />
                        <Area type="monotone" dataKey="value" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorVal)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="chart-legend">
                  <span>Data Series: Calculated Value</span>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
