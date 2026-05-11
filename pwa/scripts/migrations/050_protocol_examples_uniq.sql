-- 050_protocol_examples_uniq.sql
--
-- protocol_examples に UNIQUE (protocol_id, project_id, occurred_on) を追加。
-- gas/155 の supa_upsert が onConflict="protocol_id,project_id,occurred_on" を使うために必須。
-- occurred_on が NULL の場合は (protocol_id, project_id) で UPSERT する代替 index も追加。

ALTER TABLE protocol_examples
  DROP CONSTRAINT IF EXISTS protocol_examples_uniq;
ALTER TABLE protocol_examples
  ADD CONSTRAINT protocol_examples_uniq UNIQUE (protocol_id, project_id, occurred_on);
