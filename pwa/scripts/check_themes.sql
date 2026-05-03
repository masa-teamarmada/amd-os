SELECT
  t.id,
  t.name,
  t.primary_domain,
  COUNT(st.story_id) AS story_count,
  array_length(t.tag_keywords, 1) AS tag_kw_count
FROM atlas_themes t
LEFT JOIN atlas_story_themes st ON st.theme_id = t.id
WHERE t.status = 'active'
GROUP BY t.id, t.name, t.primary_domain, t.tag_keywords
ORDER BY story_count DESC, t.name
LIMIT 80;
