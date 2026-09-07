-- EVOLVE Quest: gestao segura do catalogo oficial de capitulos.
-- Nao cria nem altera registros de capitulos existentes.

alter table public.chapters
  alter column status set default 'draft';

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chapters_status_check'
      and conrelid = 'public.chapters'::regclass
  ) then
    alter table public.chapters
      add constraint chapters_status_check
      check (status in ('draft', 'active', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chapters_positive_numbers_check'
      and conrelid = 'public.chapters'::regclass
  ) then
    alter table public.chapters
      add constraint chapters_positive_numbers_check
      check (
        chapter_number > 0
        and (level_number is null or level_number > 0)
        and (estimated_duration_weeks is null or estimated_duration_weeks > 0)
        and display_order >= 0
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chapters_slug_format_check'
      and conrelid = 'public.chapters'::regclass
  ) then
    alter table public.chapters
      add constraint chapters_slug_format_check
      check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  end if;
end;
$block$;

create unique index if not exists chapters_active_number_unique_idx
  on public.chapters (chapter_number)
  where status = 'active';

create unique index if not exists chapters_active_slug_unique_idx
  on public.chapters (lower(slug))
  where status = 'active' and slug is not null;

drop policy if exists admin_healer_read_chapters on public.chapters;
drop policy if exists authenticated_read_chapters on public.chapters;
drop policy if exists chapters_read_by_role on public.chapters;

create policy chapters_read_by_role
on public.chapters
for select
to authenticated
using (
  status = 'active'
  or (select public.is_healer_or_admin())
);

create or replace function public.create_chapter(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_chapter public.chapters%rowtype;
  v_chapter_number integer;
  v_title text;
  v_slug text;
  v_level_number integer;
  v_description text;
  v_objective text;
  v_duration integer;
  v_display_order integer;
  v_status text;
begin
  if v_actor_id is null or not public.is_healer_or_admin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  v_chapter_number := nullif(btrim(p_data->>'chapter_number'), '')::integer;
  v_title := nullif(btrim(p_data->>'title'), '');
  v_slug := lower(nullif(btrim(p_data->>'slug'), ''));
  v_level_number := nullif(btrim(p_data->>'level_number'), '')::integer;
  v_description := nullif(btrim(p_data->>'description'), '');
  v_objective := nullif(btrim(p_data->>'objective'), '');
  v_duration := nullif(btrim(p_data->>'estimated_duration_weeks'), '')::integer;
  v_display_order := coalesce(nullif(btrim(p_data->>'display_order'), '')::integer, 0);
  v_status := coalesce(nullif(lower(btrim(p_data->>'status')), ''), 'draft');

  if v_chapter_number is null or v_chapter_number <= 0 then
    raise exception 'INVALID_CHAPTER_NUMBER' using errcode = '22023';
  end if;
  if v_title is null or char_length(v_title) > 160 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if v_slug is null or char_length(v_slug) > 160 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;
  if v_level_number is null or v_level_number <= 0 or not exists (
    select 1 from public.adventurer_levels l where l.level_number = v_level_number
  ) then
    raise exception 'INVALID_LEVEL' using errcode = '22023';
  end if;
  if v_duration is null or v_duration <= 0 then
    raise exception 'INVALID_ESTIMATED_DURATION' using errcode = '22023';
  end if;
  if v_display_order < 0 then
    raise exception 'INVALID_DISPLAY_ORDER' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  if v_status = 'active' and exists (
    select 1 from public.chapters c
    where c.status = 'active' and c.chapter_number = v_chapter_number
  ) then
    raise exception 'ACTIVE_CHAPTER_NUMBER_EXISTS' using errcode = '23505';
  end if;

  if v_status = 'active' and exists (
    select 1 from public.chapters c
    where c.status = 'active' and lower(c.slug) = v_slug
  ) then
    raise exception 'ACTIVE_CHAPTER_SLUG_EXISTS' using errcode = '23505';
  end if;

  insert into public.chapters (
    chapter_number,
    title,
    slug,
    level_number,
    description,
    objective,
    estimated_duration_weeks,
    display_order,
    status,
    archived_at,
    created_by,
    updated_by,
    created_at,
    updated_at
  ) values (
    v_chapter_number,
    v_title,
    v_slug,
    v_level_number,
    v_description,
    v_objective,
    v_duration,
    v_display_order,
    v_status,
    case when v_status = 'archived' then now() else null end,
    v_actor_id,
    v_actor_id,
    now(),
    now()
  ) returning * into v_chapter;

  insert into public.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    v_actor_id,
    'chapter_created',
    'chapter',
    v_chapter.id,
    jsonb_build_object('chapter', to_jsonb(v_chapter))
  );

  return to_jsonb(v_chapter);
end;
$function$;

revoke all on function public.create_chapter(jsonb) from public, anon;
grant execute on function public.create_chapter(jsonb) to authenticated;

create or replace function public.update_chapter(p_chapter_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_before public.chapters%rowtype;
  v_after public.chapters%rowtype;
  v_chapter_number integer;
  v_title text;
  v_slug text;
  v_level_number integer;
  v_description text;
  v_objective text;
  v_duration integer;
  v_display_order integer;
  v_status text;
begin
  if v_actor_id is null or not public.is_healer_or_admin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_chapter_id is null or p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select * into v_before
  from public.chapters
  where id = p_chapter_id
  for update;

  if not found then
    raise exception 'CHAPTER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_chapter_number := case when p_data ? 'chapter_number'
    then nullif(btrim(p_data->>'chapter_number'), '')::integer else v_before.chapter_number end;
  v_title := case when p_data ? 'title'
    then nullif(btrim(p_data->>'title'), '') else v_before.title end;
  v_slug := case when p_data ? 'slug'
    then lower(nullif(btrim(p_data->>'slug'), '')) else v_before.slug end;
  v_level_number := case when p_data ? 'level_number'
    then nullif(btrim(p_data->>'level_number'), '')::integer else v_before.level_number end;
  v_description := case when p_data ? 'description'
    then nullif(btrim(p_data->>'description'), '') else v_before.description end;
  v_objective := case when p_data ? 'objective'
    then nullif(btrim(p_data->>'objective'), '') else v_before.objective end;
  v_duration := case when p_data ? 'estimated_duration_weeks'
    then nullif(btrim(p_data->>'estimated_duration_weeks'), '')::integer else v_before.estimated_duration_weeks end;
  v_display_order := case when p_data ? 'display_order'
    then nullif(btrim(p_data->>'display_order'), '')::integer else v_before.display_order end;
  v_status := case when p_data ? 'status'
    then nullif(lower(btrim(p_data->>'status')), '') else v_before.status end;

  if v_chapter_number is null or v_chapter_number <= 0 then
    raise exception 'INVALID_CHAPTER_NUMBER' using errcode = '22023';
  end if;
  if v_title is null or char_length(v_title) > 160 then
    raise exception 'INVALID_TITLE' using errcode = '22023';
  end if;
  if v_slug is null or char_length(v_slug) > 160 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;
  if v_level_number is null or v_level_number <= 0 or not exists (
    select 1 from public.adventurer_levels l where l.level_number = v_level_number
  ) then
    raise exception 'INVALID_LEVEL' using errcode = '22023';
  end if;
  if v_duration is null or v_duration <= 0 then
    raise exception 'INVALID_ESTIMATED_DURATION' using errcode = '22023';
  end if;
  if v_display_order is null or v_display_order < 0 then
    raise exception 'INVALID_DISPLAY_ORDER' using errcode = '22023';
  end if;
  if v_status not in ('draft', 'active', 'archived') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  if v_before.status = 'active' and v_status <> 'active' and exists (
    select 1 from public.adventurer_journeys j
    where j.current_chapter_id = p_chapter_id
      and j.status in ('locked', 'active', 'paused')
  ) then
    raise exception 'CHAPTER_IN_USE' using errcode = '23503';
  end if;

  if v_status = 'active' and exists (
    select 1 from public.chapters c
    where c.id <> p_chapter_id
      and c.status = 'active'
      and c.chapter_number = v_chapter_number
  ) then
    raise exception 'ACTIVE_CHAPTER_NUMBER_EXISTS' using errcode = '23505';
  end if;

  if v_status = 'active' and exists (
    select 1 from public.chapters c
    where c.id <> p_chapter_id
      and c.status = 'active'
      and lower(c.slug) = v_slug
  ) then
    raise exception 'ACTIVE_CHAPTER_SLUG_EXISTS' using errcode = '23505';
  end if;

  update public.chapters
  set chapter_number = v_chapter_number,
      title = v_title,
      slug = v_slug,
      level_number = v_level_number,
      description = v_description,
      objective = v_objective,
      estimated_duration_weeks = v_duration,
      display_order = v_display_order,
      status = v_status,
      archived_at = case when v_status = 'archived' then coalesce(v_before.archived_at, now()) else null end,
      updated_by = v_actor_id,
      updated_at = now()
  where id = p_chapter_id
  returning * into v_after;

  insert into public.admin_audit_logs (
    actor_id, action, resource_type, resource_id, metadata
  ) values (
    v_actor_id,
    'chapter_updated',
    'chapter',
    v_after.id,
    jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after))
  );

  return to_jsonb(v_after);
end;
$function$;

revoke all on function public.update_chapter(uuid, jsonb) from public, anon;
grant execute on function public.update_chapter(uuid, jsonb) to authenticated;
