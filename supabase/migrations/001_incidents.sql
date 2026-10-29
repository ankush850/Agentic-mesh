-- Supabase pgvector Knowledge Base Migration
-- Schema for storing historical failure signatures and automated remediation actions

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS incident_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(100) NOT NULL,
    error_signature TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    remediation_action TEXT NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 0.950,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_embedding 
ON incident_history USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- RPC Function for Cosine Distance Matching
CREATE OR REPLACE FUNCTION match_incidents (
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id UUID,
    service VARCHAR(100),
    error_signature TEXT,
    root_cause TEXT,
    remediation_action TEXT,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        incident_history.id,
        incident_history.service,
        incident_history.error_signature,
        incident_history.root_cause,
        incident_history.remediation_action,
        1 - (incident_history.embedding <=> query_embedding) AS similarity
    FROM incident_history
    WHERE 1 - (incident_history.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
