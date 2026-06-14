-- Merge duplicate researcher rows created when PINFL was added by a later import.
-- A group is eligible only when it has exactly one populated PINFL row, so
-- people with the same name/specialty but different PINFL values are untouched.
with eligible_keys as (
  select
    university_id,
    turi,
    lower(btrim(full_name)) as normalized_name,
    lower(btrim(coalesce(specialty_code, ''))) as normalized_specialty
  from public.izlanuvchilar
  group by
    university_id,
    turi,
    lower(btrim(full_name)),
    lower(btrim(coalesce(specialty_code, '')))
  having count(*) filter (where nullif(btrim(pinfl), '') is not null) = 1
     and count(*) filter (where nullif(btrim(pinfl), '') is null) > 0
),
ranked_losers as (
  select
    keeper.id as keeper_id,
    loser.*,
    row_number() over (
      partition by keeper.id
      order by loser.updated_at desc, loser.created_at desc, loser.id
    ) as loser_rank
  from eligible_keys keys
  join public.izlanuvchilar keeper
    on keeper.university_id = keys.university_id
   and keeper.turi = keys.turi
   and lower(btrim(keeper.full_name)) = keys.normalized_name
   and lower(btrim(coalesce(keeper.specialty_code, ''))) = keys.normalized_specialty
   and nullif(btrim(keeper.pinfl), '') is not null
  join public.izlanuvchilar loser
    on loser.university_id = keys.university_id
   and loser.turi = keys.turi
   and lower(btrim(loser.full_name)) = keys.normalized_name
   and lower(btrim(coalesce(loser.specialty_code, ''))) = keys.normalized_specialty
   and nullif(btrim(loser.pinfl), '') is null
),
best_loser as (
  select * from ranked_losers where loser_rank = 1
)
update public.izlanuvchilar keeper
set
  source_no = coalesce(nullif(btrim(keeper.source_no), ''), loser.source_no),
  specialty_name = coalesce(nullif(btrim(keeper.specialty_name), ''), loser.specialty_name),
  education_stage = coalesce(nullif(btrim(keeper.education_stage), ''), loser.education_stage),
  admission_year = coalesce(nullif(btrim(keeper.admission_year), ''), loser.admission_year),
  age = coalesce(keeper.age, loser.age),
  gender = coalesce(nullif(btrim(keeper.gender), ''), loser.gender),
  submission_date = coalesce(keeper.submission_date, loser.submission_date),
  course = coalesce(nullif(btrim(keeper.course), ''), loser.course),
  monitoring_1 = coalesce(nullif(btrim(keeper.monitoring_1), ''), loser.monitoring_1),
  monitoring_2 = coalesce(nullif(btrim(keeper.monitoring_2), ''), loser.monitoring_2),
  monitoring_3 = coalesce(nullif(btrim(keeper.monitoring_3), ''), loser.monitoring_3),
  district = coalesce(nullif(btrim(keeper.district), ''), loser.district),
  research_topic = coalesce(nullif(btrim(keeper.research_topic), ''), loser.research_topic),
  supervisor_name = coalesce(nullif(btrim(keeper.supervisor_name), ''), loser.supervisor_name),
  status = coalesce(nullif(btrim(keeper.status), ''), loser.status),
  talim_tili = coalesce(nullif(btrim(keeper.talim_tili), ''), loser.talim_tili),
  chorak = coalesce(nullif(btrim(keeper.chorak), ''), loser.chorak),
  phone = coalesce(nullif(btrim(keeper.phone), ''), loser.phone),
  himoya_holati = coalesce(nullif(btrim(keeper.himoya_holati), ''), loser.himoya_holati),
  metadata = coalesce(loser.metadata, '{}'::jsonb) || coalesce(keeper.metadata, '{}'::jsonb)
from best_loser loser
where keeper.id = loser.keeper_id;

with eligible_keys as (
  select
    university_id,
    turi,
    lower(btrim(full_name)) as normalized_name,
    lower(btrim(coalesce(specialty_code, ''))) as normalized_specialty
  from public.izlanuvchilar
  group by
    university_id,
    turi,
    lower(btrim(full_name)),
    lower(btrim(coalesce(specialty_code, '')))
  having count(*) filter (where nullif(btrim(pinfl), '') is not null) = 1
     and count(*) filter (where nullif(btrim(pinfl), '') is null) > 0
)
delete from public.izlanuvchilar loser
using eligible_keys keys
where loser.university_id = keys.university_id
  and loser.turi = keys.turi
  and lower(btrim(loser.full_name)) = keys.normalized_name
  and lower(btrim(coalesce(loser.specialty_code, ''))) = keys.normalized_specialty
  and nullif(btrim(loser.pinfl), '') is null;
