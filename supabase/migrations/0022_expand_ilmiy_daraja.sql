-- Replace ilmiy_daraja values with phd, dsc, darajasiz
ALTER TABLE teachers
  DROP CONSTRAINT IF EXISTS teachers_ilmiy_daraja_check;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_ilmiy_daraja_check
  CHECK (ilmiy_daraja IN ('phd', 'dsc', 'darajasiz'));
