-- Prevent duplicate teachers: same name + department within a university.
-- First clean up any existing duplicates (keep oldest row).
DELETE FROM teachers
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY university_id, department_id,
                          lower(last_name), lower(first_name), lower(coalesce(middle_name,''))
             ORDER BY created_at
           ) AS rn
    FROM teachers
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS teachers_uniq_name_dept
  ON teachers (university_id, department_id,
               lower(last_name), lower(first_name), lower(coalesce(middle_name, '')));
