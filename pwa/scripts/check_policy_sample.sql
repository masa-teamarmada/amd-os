SELECT
  source_type,
  COUNT(*) AS cnt,
  COUNT(DISTINCT story_id) AS stories,
  COUNT(*) FILTER (WHERE importance = 'high') AS high_cnt
FROM atlas_signals
WHERE source_type = 'policy'
GROUP BY source_type;
