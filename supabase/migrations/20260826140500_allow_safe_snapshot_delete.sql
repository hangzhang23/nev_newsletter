create or replace function public.replace_nev_dataset(
  p_vehicles jsonb,
  p_weeks jsonb,
  p_brands jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_vehicles) <> 'array' or jsonb_array_length(p_vehicles) = 0 then
    raise exception 'p_vehicles must be a non-empty array';
  end if;
  if jsonb_typeof(p_weeks) <> 'array' or jsonb_array_length(p_weeks) = 0 then
    raise exception 'p_weeks must be a non-empty array';
  end if;
  if jsonb_typeof(p_brands) <> 'array' or jsonb_array_length(p_brands) = 0 then
    raise exception 'p_brands must be a non-empty array';
  end if;

  delete from public.vehicles where true;
  delete from public.weeks where true;
  delete from public.brands where true;

  insert into public.vehicles (
    name, brand, brand_color, is_primary_brand, release_date,
    price_range, price_min, price_max, positioning, dimensions,
    wheelbase, powertrain, power, acceleration, battery_capacity,
    range_cltc, adas_chip, lidar, computing_power, cabin_chip,
    screen, highlights, competitors, source, week
  )
  select
    v->>'name',
    v->>'brand',
    nullif(v->>'brandColor', ''),
    coalesce((v->>'isPrimaryBrand')::boolean, false),
    nullif(v->>'releaseDate', '')::date,
    nullif(v->>'priceRange', ''),
    (v->>'priceMin')::numeric,
    (v->>'priceMax')::numeric,
    nullif(v->>'positioning', ''),
    nullif(v->>'dimensions', ''),
    (v->>'wheelbase')::integer,
    nullif(v->>'powertrain', ''),
    nullif(v->>'power', ''),
    nullif(v->>'acceleration', ''),
    nullif(v->>'batteryCapacity', ''),
    nullif(v->>'rangeCltc', ''),
    nullif(v->>'adasChip', ''),
    nullif(v->>'lidar', ''),
    nullif(v->>'computingPower', ''),
    nullif(v->>'cabinChip', ''),
    nullif(v->>'screen', ''),
    nullif(v->>'highlights', ''),
    nullif(v->>'competitors', ''),
    nullif(v->>'source', ''),
    v->>'week'
  from jsonb_array_elements(p_vehicles) as vehicle(v);

  insert into public.weeks (week, start_date, end_date)
  select
    w->>'week',
    (w->>'start_date')::date,
    (w->>'end_date')::date
  from jsonb_array_elements(p_weeks) as week(w);

  insert into public.brands (name, color, is_primary, frequency)
  select
    b->>'name',
    nullif(b->>'color', ''),
    coalesce((b->>'is_primary')::boolean, false),
    coalesce((b->>'frequency')::integer, 0)
  from jsonb_array_elements(p_brands) as brand(b);
end;
$$;

revoke execute on function public.replace_nev_dataset(jsonb, jsonb, jsonb) from public;
revoke execute on function public.replace_nev_dataset(jsonb, jsonb, jsonb) from anon, authenticated;
grant execute on function public.replace_nev_dataset(jsonb, jsonb, jsonb) to service_role;
