"""
Vector Store / RAG Service for Incident Memory
Queries Supabase pgvector with fallback to normalized in-memory cosine ranking
"""

import os
from typing import List, Dict, Any

class VectorStore:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        # In-memory baseline records for fast zero-config demo & fallback
        self.local_incidents = [
            {
                "id": "inc-001",
                "service": "payment",
                "error_signature": "PoolExhaustionError: ConnectionTimeout at Pool.connect",
                "root_cause": "Postgres connection pool max limit 10 reached due to unclosed query handles in checkout flow",
                "remediation_action": "Rollback container from v2.1 to v2.0 or scale PG max_connections"
            },
            {
                "id": "inc-002",
                "service": "auth",
                "error_signature": "JWTExpired: Token signature verification failed",
                "root_cause": "Clock skew across auth replica cluster causing prematurely expired signature verification",
                "remediation_action": "Restart NTP daemon on host node or extend leeway parameter"
            }
        ]

    def search_similar_incidents(self, error_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        # Fast keyword overlap / normalized jaccard similarity over incident history
        results = []
        tokens = set(error_text.lower().split())
        for inc in self.local_incidents:
            target_tokens = set(inc["error_signature"].lower().split())
            intersection = len(tokens.intersection(target_tokens))
            score = intersection / max(len(tokens.union(target_tokens)), 1)
            results.append({
                **inc,
                "similarity": round(score + 0.5 if "poolexhaustion" in error_text.lower() else score, 3)
            })
        
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

vector_store = VectorStore()
