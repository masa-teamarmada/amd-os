SELECT
  source_type,
  COUNT(*) AS cnt,
  MIN(submitted_at) AS first_submit,
  MAX(submitted_at) AS last_submit
FROM atlas_signals
GROUP BY source_type
ORDER BY cnt DESC;
