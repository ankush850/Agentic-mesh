"""
FastAPI Bridge Server for Python AI Engine
Serves endpoints for AST pruning and LangGraph Incident Analysis
"""

from fastapi import FastAPI
from pydantic import BaseModel
import sys
import os

# Add local path
sys.path.append(os.path.dirname(__file__))

from agents.graph import run_incident_graph
from ast_pruner import prune_code_at_line

app = FastAPI(title="SentinelQA / AgenticMesh AI Engine", version="1.0.0")

class AnalyzeRequest(BaseModel):
    service: str
    error_log: str
    stack_trace: str = ""

class PruneRequest(BaseModel):
    file_path: str
    line_number: int

@app.get("/health")
def health():
    return {"status": "healthy", "engine": "LangGraph + pgvector + AST pruner"}

@app.post("/analyze-incident")
def analyze_incident(req: AnalyzeRequest):
    result = run_incident_graph(
        service=req.service,
        error_log=req.error_log,
        stack_trace=req.stack_trace
    )
    return result

@app.post("/prune-ast")
def prune_ast(req: PruneRequest):
    return prune_code_at_line(req.file_path, req.line_number)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
