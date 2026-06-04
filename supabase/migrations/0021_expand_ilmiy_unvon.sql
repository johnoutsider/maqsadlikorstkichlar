-- Narrow ilmiy_unvon to professor, dotsent, unvonsiz
ALTER TABLE teachers
  DROP CONSTRAINT IF EXISTS teachers_ilmiy_unvon_check;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_ilmiy_unvon_check
  CHECK (ilmiy_unvon IN ('professor', 'dotsent', 'unvonsiz'));
