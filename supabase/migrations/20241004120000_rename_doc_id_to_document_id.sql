-- Rename doc_id to document_id in document_segments table
ALTER TABLE document_segments RENAME COLUMN doc_id TO document_id;

-- Update match_document_segments function to use document_id
CREATE OR REPLACE FUNCTION match_document_segments(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter jsonb
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  type text,
  role text,
  text text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.document_id,
    ds.type,
    ds.role,
    ds.text,
    ds.metadata,
    1 - (ds.embedding <=> query_embedding) AS similarity
  FROM document_segments ds
  WHERE (
      (filter->>'document_id') IS NULL OR ds.document_id = ANY (SELECT jsonb_array_elements_text(filter->'document_id'))
    )
    AND (
      (filter->>'type') IS NULL OR ds.type = ANY (SELECT jsonb_array_elements_text(filter->'type'))
    )
    AND (
      (filter->>'role') IS NULL OR ds.role = ANY (SELECT jsonb_array_elements_text(filter->'role'))
    )
    AND 1 - (ds.embedding <=> query_embedding) > match_threshold
  ORDER BY ds.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
