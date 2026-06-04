-- Expand ish_turi CHECK constraint to include new employment types
ALTER TABLE teachers
  DROP CONSTRAINT IF EXISTS teachers_ish_turi_check;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_ish_turi_check
  CHECK (ish_turi IN (
    'asosiy',
    'doktorant',
    'doktorant_shartnoma',
    'doktorant_ichki_orindosh',
    'ichki_orindosh',
    'magistrant',
    'shartnoma_muddatli',
    'tashqi_orindosh'
  ));
