import os
import json

class IncidentVectorStore:
    def __init__(self):
        self.incidents = []

    def insert_incident(self, signature: str, root_cause: str, remediation: str):
        self.incidents.append({
            "error_signature": signature,
            "root_cause": root_cause,
            "remediation_action": remediation
        })

    def search_similar(self, error_message: str, top_k: int = 3):
        return self.incidents[:top_k]
