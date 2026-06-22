alter table public.indicators
  add column if not exists calculation_config jsonb;

alter table public.indicators
  drop constraint if exists indicators_calculation_config_chk;

alter table public.indicators
  add constraint indicators_calculation_config_chk
  check (
    calculation_config is null
    or (
      jsonb_typeof(calculation_config) = 'object'
      and calculation_config ->> 'type' = 'percentage'
      and jsonb_typeof(calculation_config -> 'denominator') = 'object'
      and coalesce(calculation_config #>> '{denominator,key}', '') <> ''
      and coalesce(calculation_config #>> '{denominator,label}', '') <> ''
      and jsonb_typeof(calculation_config -> 'numerators') = 'array'
      and jsonb_array_length(calculation_config -> 'numerators') >= 1
    )
  );
