import os
import io
import sys
import json
import pandas as pd
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

app = FastAPI(title="AI Operations & Sales Analyst Agent Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "uploaded_sales_data.csv"

# Helper Functions
def get_gemini_client(api_key: Optional[str] = None):
    key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise HTTPException(
            status_code=401, 
            detail="Gemini API Key missing. Configure it in the API-Key header or UI settings."
        )
    genai.configure(api_key=key)
    return genai

class QueryRequest(BaseModel):
    query: str
    api_key: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    code: str
    execution_result: str
    chart_data: Optional[List[Dict[str, Any]]] = None

@app.post("/upload")
async def upload_dataset(
    file: UploadFile = File(...),
):
    # Determine extension
    ext = os.path.splitext(file.filename)[1].lower()
    contents = await file.read()
    
    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(contents))
        elif ext in [".xls", ".xlsx"]:
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a CSV or Excel file.")
        
        # Save as standard CSV
        df.to_csv(DATA_FILE, index=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse dataset: {str(e)}")

    # Return summary schema
    info_buf = io.StringIO()
    df.info(buf=info_buf)
    
    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": list(df.columns),
        "schema": info_buf.getvalue(),
        "preview": df.head(3).to_dict(orient="records")
    }

@app.get("/dataset-info")
async def get_dataset_info():
    if not os.path.exists(DATA_FILE):
        return {"status": "empty", "message": "No dataset uploaded yet."}
    
    df = pd.read_csv(DATA_FILE)
    return {
        "status": "ready",
        "rows": len(df),
        "columns": list(df.columns),
        "preview": df.head(5).to_dict(orient="records")
    }

@app.post("/query", response_model=QueryResponse)
async def query_dataset(
    request: QueryRequest,
    x_api_key: Optional[str] = Header(None)
):
    actual_key = request.api_key or x_api_key
    client = get_gemini_client(actual_key)

    if not os.path.exists(DATA_FILE):
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please upload a CSV/Excel file first.")

    # Load dataset
    df = pd.read_csv(DATA_FILE)
    
    # Extract schema info to provide to LLM
    columns = list(df.columns)
    sample_data = df.head(3).to_string()
    dtypes = df.dtypes.to_string()

    # Step 1: Prompt Gemini to write Python Pandas code to compute the result
    code_generation_prompt = f"""You are an expert Data Science Agent. Your task is to write Python code using Pandas to answer the user's question about the pre-loaded DataFrame 'df'.

DataFrame Schema:
Columns: {columns}
Data Types:
{dtypes}

First 3 rows of 'df':
{sample_data}

Rules:
1. Write ONLY valid python code. Do not include markdown blocks or any text outside the code block.
2. The code will execute in an environment where 'df' is already loaded.
3. Compute the answer and print it out using `print()`.
4. If the user asks for a chart or visualization, calculate the relevant series, aggregate it, and format it as a JSON-serializable list of dictionaries. Assign it to a variable named `chart_data` (e.g. `chart_data = [{"label": "A", "value": 10}, {"label": "B", "value": 20}]`).
5. Ensure robust handling of column names (e.g. trimming spaces, lowercasing if necessary, converting column types).

User Question: {request.query}

Write the code now:"""

    try:
        model = client.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(code_generation_prompt)
        python_code = response.text.replace("```python", "").replace("```", "").strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate code: {str(e)}")

    # Step 2: Execute python code safely and capture stdout
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    
    loc = {"df": df, "chart_data": None}
    error_occurred = False
    execution_result = ""
    
    try:
        # Execute the python code inside the local context
        exec(python_code, globals(), loc)
        sys.stdout = old_stdout
        execution_result = redirected_output.getvalue()
    except Exception as e:
        sys.stdout = old_stdout
        error_occurred = True
        execution_result = f"Error during execution: {str(e)}"

    # Retrieve chart_data if any
    chart_data = loc.get("chart_data")

    # Step 3: Send code result back to LLM to formulate a beautiful human answer
    synthesis_prompt = f"""You are a professional Business Intelligence Analyst. Explain the result of executing python code to answer a user's question.

User Question: {request.query}

Python Code Executed:
```python
{python_code}
```

Code Standard Output / Result:
{execution_result}

Summarize this result clearly for the user. Highlight key insights, numbers, or trends."""

    try:
        synthesis_response = model.generate_content(synthesis_prompt)
        final_answer = synthesis_response.text
    except Exception as e:
        final_answer = f"Code executed successfully. Output:\n{execution_result}"

    return {
        "answer": final_answer,
        "code": python_code,
        "execution_result": execution_result,
        "chart_data": chart_data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
