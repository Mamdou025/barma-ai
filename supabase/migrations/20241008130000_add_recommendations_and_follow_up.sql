-- Create recommendations table
CREATE TABLE recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(id) ON DELETE CASCADE,
  text text NOT NULL,
  target_entities text[],
  irregularities text[],
  deadline date,
  follow_up_state text
);

-- Add follow-up columns to document_segments
ALTER TABLE document_segments
  ADD COLUMN observation_id uuid,
  ADD COLUMN recommendation_id uuid REFERENCES recommendations(id),
  ADD COLUMN response_to uuid REFERENCES recommendations(id),
  ADD COLUMN amount_max numeric,
  ADD COLUMN follow_up_state text;

-- Enforce foreign keys on kg_edges
ALTER TABLE kg_edges
  ADD CONSTRAINT kg_edges_src_doc_id_fkey FOREIGN KEY (src_doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  ADD CONSTRAINT kg_edges_src_segment_id_fkey FOREIGN KEY (src_segment_id) REFERENCES document_segments(id) ON DELETE CASCADE;

-- Restrict rel values and include new follow-up relations
ALTER TABLE kg_edges DROP CONSTRAINT IF EXISTS kg_edges_rel_check;
ALTER TABLE kg_edges
  ADD CONSTRAINT kg_edges_rel_check CHECK (
    rel IN (
      'cites',
      'distinguishes',
      'follows',
      'overrules',
      'interprets',
      'applies',
      'implements',
      'refersTo',
      'discusses',
      'targets',
      'covers',
      'addressesIrregularity',
      'leadsTo',
      'hasObservation',
      'hasRecommendation',
      'elicitsResponseFrom',
      'respondsTo'
    )
  );
