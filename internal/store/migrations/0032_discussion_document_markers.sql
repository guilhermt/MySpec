-- A discussion keeps no document of its own: its cards are its only output. The
-- markers a conversation recorded for one leave with it.
DELETE FROM transcript_entries
WHERE kind = 'marker'
  AND CASE WHEN json_valid(payload) THEN json_extract(payload, '$.type') = 'discussion_document' ELSE 0 END;
