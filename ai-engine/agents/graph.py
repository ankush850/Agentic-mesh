"""
LangGraph Multi-Agent Orchestration Engine for AgenticMesh
TriageAgent -> RetrievalAgent -> RootCauseAnalysisAgent
"""

from typing import TypedDict, List, Optional
import os
import json

class IncidentState(TypedDict):
    service: str
    error_log: str
    stack_trace: str
    code_snippet: Optional[str]
    triage_severity: Optional[str]
    similar_past_incidents: Optional[List[dict]]
    root_cause: Optional[str]
    remediation_proposal: Optional[dict]
    status: str

def triage_agent(state: IncidentState) -> IncidentState:
    log_lower = state["error_log"].lower()
    if "fatal" in log_lower or "500" in log_lower or "crash" in log_lower or "exhaustion" in log_lower:
        severity = "CRITICAL_P0"
    elif "warning" in log_lower:
        severity = "MEDIUM_P2"
    else:
        severity = "HIGH_P1"

    state["triage_severity"] = severity
    return state

def retrieval_agent(state: IncidentState) -> IncidentState:
    from vector_store import vector_store
    matches = vector_store.search_similar_incidents(state["error_log"])
    state["similar_past_incidents"] = matches
    return state

def rca_agent(state: IncidentState) -> IncidentState:
    service = state.get("service", "unknown")
    severity = state.get("triage_severity", "HIGH_P1")
    matches = state.get("similar_past_incidents", [])

    if "poolexhaustion" in state["error_log"].lower():
        rca = (
            f"Cascading database pool exhaustion detected in '{service}'. "
            "High concurrency without connection pooling timeouts caused connection starvation on port 5432."
        )
        proposal = {
            "action_type": "DOCKER_ROLLBACK",
            "target_service": service,
            "current_image": f"sentinelqa/{service}:v2.1",
            "rollback_image": f"sentinelqa/{service}:v2.0",
            "safe_to_execute": True,
            "estimated_recovery_time_sec": 4.5
        }
    else:
        rca = f"Uncaught runtime exception in '{service}'. Severity: {severity}."
        proposal = {
            "action_type": "RESTART_CONTAINER",
            "target_service": service,
            "current_image": f"sentinelqa/{service}:latest",
            "rollback_image": None,
            "safe_to_execute": True,
            "estimated_recovery_time_sec": 3.0
        }

    state["root_cause"] = rca
    state["remediation_proposal"] = proposal
    state["status"] = "TRIAGED_AND_ANALYZED"
    return state

def run_incident_graph(service: str, error_log: str, stack_trace: str = "") -> IncidentState:
    # Build linear state chain: Triage -> Retrieval -> RCA
    initial_state: IncidentState = {
        "service": service,
        "error_log": error_log,
        "stack_trace": stack_trace,
        "code_snippet": None,
        "triage_severity": None,
        "similar_past_incidents": None,
        "root_cause": None,
        "remediation_proposal": None,
        "status": "INIT"
    }

    s1 = triage_agent(initial_state)
    s2 = retrieval_agent(s1)
    s3 = rca_agent(s2)
    return s3

if __name__ == "__main__":
    demo_output = run_incident_graph(
        service="payment",
        error_log="FATAL: Database connection pool exhausted on postgres-primary-cluster:5432"
    )
    print(json.dumps(demo_output, indent=2))
