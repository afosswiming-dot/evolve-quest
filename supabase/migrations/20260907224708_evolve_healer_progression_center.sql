-- EVOLVE Quest: central de acompanhamento de progresso do Healer.
-- Nao altera Jornadas nem dados dos Aventureiros.

drop index if exists public.chapters_active_number_unique_idx;

create unique index if not exists chapters_active_level_number_unique_idx
  on public.chapters (level_number, chapter_number)
  where status = 'active';

create or replace function public.get_healer_progressions(
  p_search text default null,
  p_status text default null,
  p_level integer default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_order text default 'priority_desc'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor_id is null or not public.is_healer_or_admin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if coalesce(p_page, 1) < 1 or coalesce(p_page_size, 20) < 1 or coalesce(p_page_size, 20) > 100 then
    raise exception 'INVALID_PAGINATION' using errcode = '22023';
  end if;

  if coalesce(p_order, 'priority_desc') not in ('priority_desc', 'oldest_asc', 'recent_desc', 'name_asc') then
    raise exception 'INVALID_ORDER' using errcode = '22023';
  end if;

  with chapter_sequence as (
    select
      c.id,
      lead(c.id) over (
        order by c.level_number, c.chapter_number, c.display_order, c.id
      ) as next_chapter_id
    from public.chapters c
    where c.status = 'active'
  ), raw as (
    select
      p.id as adventurer_id,
      p.full_name,
      p.preferred_name,
      coalesce(nullif(p.preferred_name, ''), p.full_name) as display_name,
      p.journey_stage,
      j.id as journey_id,
      j.status as journey_status,
      coalesce(j.current_level, p.current_level) as current_level,
      l.name as level_name,
      ch.id as chapter_id,
      ch.chapter_number,
      ch.title as chapter_title,
      coalesce(changed.started_at, j.started_at, j.created_at) as chapter_started_at,
      coalesce(j.chapter_progress, 0)::integer as chapter_progress,
      greatest(0, coalesce(j.planned_sessions, j.prescribed_frequency * j.chapter_duration_weeks, 0))::integer as planned_sessions,
      coalesce(completed.completed_sessions, 0)::integer as completed_sessions,
      activity.last_activity_at,
      cp.id as checkpoint_id,
      cp.status as checkpoint_assignment_status,
      cp.available_at as checkpoint_available_at,
      cp.due_at as checkpoint_due_at,
      cp.completed_at as checkpoint_completed_at,
      cr.id as checkpoint_review_id,
      cr.status as checkpoint_review_status,
      progression.id as progression_id,
      progression.status as progression_status,
      next_ch.id as next_chapter_id,
      next_ch.level_number as next_level_number,
      next_level.name as next_level_name,
      next_ch.chapter_number as next_chapter_number,
      next_ch.title as next_chapter_title
    from public.profiles p
    join lateral (
      select aj.*
      from public.adventurer_journeys aj
      where aj.adventurer_id = p.id
        and aj.status in ('locked', 'active', 'paused', 'completed')
      order by
        case aj.status when 'active' then 0 when 'paused' then 1 when 'locked' then 2 else 3 end,
        aj.created_at desc
      limit 1
    ) j on true
    left join public.chapters ch on ch.id = j.current_chapter_id
    left join chapter_sequence seq on seq.id = ch.id
    left join public.chapters next_ch on next_ch.id = seq.next_chapter_id
    left join public.adventurer_levels l on l.level_number = coalesce(j.current_level, p.current_level)
    left join public.adventurer_levels next_level on next_level.level_number = next_ch.level_number
    left join lateral (
      select max(jp.approved_at) as started_at
      from public.journey_progressions jp
      where jp.adventurer_id = p.id
        and jp.previous_journey_id = j.id
        and jp.new_chapter_id = j.current_chapter_id
        and jp.status = 'approved'
        and jp.approved_at is not null
    ) changed on true
    left join lateral (
      select count(*)::integer as completed_sessions
      from public.mission_registrations mr
      where mr.adventurer_id = p.id
        and mr.journey_id = j.id
        and mr.chapter_id = j.current_chapter_id
        and mr.completion_status = 'completed'
    ) completed on true
    left join lateral (
      select max(coalesce(mr.submitted_at, mr.completed_at, mr.created_at)) as last_activity_at
      from public.mission_registrations mr
      where mr.adventurer_id = p.id
        and mr.journey_id = j.id
        and mr.chapter_id = j.current_chapter_id
    ) activity on true
    left join lateral (
      select ca.*
      from public.checkpoint_assignments ca
      where ca.adventurer_id = p.id and ca.journey_id = j.id
      order by ca.created_at desc
      limit 1
    ) cp on true
    left join public.checkpoint_reviews cr on cr.checkpoint_assignment_id = cp.id
    left join lateral (
      select jp.id, jp.status
      from public.journey_progressions jp
      where jp.adventurer_id = p.id
        and jp.previous_journey_id = j.id
        and jp.status in ('draft', 'in_review', 'blocked')
      order by jp.created_at desc
      limit 1
    ) progression on true
    where p.role = 'adventurer'
      and p.account_status = 'active'
      and p.journey_stage in ('dashboard', 'checkpoint', 'feedback', 'progression')
      and public.can_manage_adventurer(p.id)
  ), enriched as (
    select raw.*,
      case
        when journey_status = 'completed'
          or (next_chapter_id is null and chapter_progress >= 100 and checkpoint_assignment_status = 'completed')
          then 'completed'
        when checkpoint_review_status = 'progression_ready' or journey_stage = 'progression'
          then 'fit_progression'
        when checkpoint_review_status in ('pending', 'in_review', 'reviewed', 'feedback_ready')
          or progression_status = 'in_review' or journey_stage = 'feedback'
          then 'awaiting_analysis'
        when checkpoint_assignment_status = 'available'
          then 'checkpoint_available'
        when chapter_progress >= 100
          or checkpoint_assignment_status in ('locked', 'in_progress')
          then 'checkpoint_pending'
        else 'in_progress'
      end as status_code,
      case
        when checkpoint_review_status in ('pending', 'in_review', 'reviewed', 'feedback_ready') then 'awaiting_analysis'
        when checkpoint_assignment_status = 'completed' then 'completed'
        when checkpoint_assignment_status = 'in_progress' then 'sent'
        when checkpoint_assignment_status = 'available' then 'available'
        when checkpoint_assignment_status = 'locked' then 'locked'
        else 'none'
      end as checkpoint_state
    from raw
  ), filtered as (
    select e.*,
      case e.status_code
        when 'fit_progression' then 0
        when 'awaiting_analysis' then 1
        when 'checkpoint_available' then 2
        when 'checkpoint_pending' then 3
        when 'in_progress' then 4
        else 5
      end as priority_rank
    from enriched e
    where (p_search is null or btrim(p_search) = ''
      or e.full_name ilike '%' || btrim(p_search) || '%'
      or e.preferred_name ilike '%' || btrim(p_search) || '%')
      and (p_status is null or btrim(p_status) = '' or e.status_code = p_status)
      and (p_level is null or e.current_level = p_level)
  ), paged as (
    select f.*
    from filtered f
    order by
      case when p_order = 'priority_desc' then f.priority_rank end asc,
      case when p_order = 'oldest_asc' then f.chapter_started_at end asc nulls last,
      case when p_order = 'recent_desc' then coalesce(f.last_activity_at, f.chapter_started_at) end desc nulls last,
      case when p_order = 'name_asc' then lower(f.display_name) end asc,
      f.priority_rank asc,
      lower(f.display_name) asc
    limit p_page_size
    offset (p_page - 1) * p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.adventurer_id,
        'adventurerId', q.adventurer_id,
        'fullName', q.full_name,
        'preferredName', q.preferred_name,
        'displayName', q.display_name,
        'journeyId', q.journey_id,
        'journeyStatus', q.journey_status,
        'currentLevel', q.current_level,
        'levelName', q.level_name,
        'chapterId', q.chapter_id,
        'chapterNumber', q.chapter_number,
        'chapterTitle', q.chapter_title,
        'chapterStartedAt', q.chapter_started_at,
        'chapterProgress', q.chapter_progress,
        'plannedSessions', q.planned_sessions,
        'completedSessions', q.completed_sessions,
        'lastActivityAt', q.last_activity_at,
        'status', q.status_code,
        'statusLabel', case q.status_code
          when 'checkpoint_available' then 'Checkpoint disponível'
          when 'checkpoint_pending' then 'Checkpoint pendente'
          when 'awaiting_analysis' then 'Aguardando análise'
          when 'fit_progression' then 'Apto para progressão'
          when 'completed' then 'Concluído'
          else 'Em andamento'
        end,
        'checkpoint', jsonb_build_object(
          'id', q.checkpoint_id,
          'state', q.checkpoint_state,
          'assignmentStatus', q.checkpoint_assignment_status,
          'reviewStatus', q.checkpoint_review_status,
          'availableAt', q.checkpoint_available_at,
          'dueAt', q.checkpoint_due_at,
          'completedAt', q.checkpoint_completed_at
        ),
        'progressionId', q.progression_id,
        'progressionStatus', q.progression_status,
        'nextChapter', case when q.next_chapter_id is null then null else jsonb_build_object(
          'id', q.next_chapter_id,
          'levelNumber', q.next_level_number,
          'levelName', q.next_level_name,
          'chapterNumber', q.next_chapter_number,
          'title', q.next_chapter_title
        ) end
      ) order by
        case when p_order = 'priority_desc' then q.priority_rank end asc,
        case when p_order = 'oldest_asc' then q.chapter_started_at end asc nulls last,
        case when p_order = 'recent_desc' then coalesce(q.last_activity_at, q.chapter_started_at) end desc nulls last,
        case when p_order = 'name_asc' then lower(q.display_name) end asc,
        q.priority_rank asc,
        lower(q.display_name) asc)
      from paged q
    ), '[]'::jsonb),
    'totalCount', (select count(*) from filtered),
    'summary', jsonb_build_object(
      'activeAdventurers', (select count(*) from enriched),
      'inProgress', (select count(*) from enriched where status_code = 'in_progress'),
      'checkpointReady', (select count(*) from enriched where chapter_progress >= 100 and coalesce(checkpoint_assignment_status, 'none') in ('none', 'locked', 'available')),
      'awaitingProgression', (select count(*) from enriched where status_code = 'fit_progression')
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_healer_progressions(text, text, integer, integer, integer, text) from public, anon;
grant execute on function public.get_healer_progressions(text, text, integer, integer, integer, text) to authenticated;

-- As RPCs abaixo permanecem disponiveis para o fluxo legado/futuro, mas nao
-- devem ser expostas ao papel anonimo.
revoke all on function public.get_progression_detail(uuid) from public, anon;
revoke all on function public.save_evolution_feedback(uuid, jsonb) from public, anon;
revoke all on function public.save_progression_draft(uuid, jsonb) from public, anon;
grant execute on function public.get_progression_detail(uuid) to authenticated;
grant execute on function public.save_evolution_feedback(uuid, jsonb) to authenticated;
grant execute on function public.save_progression_draft(uuid, jsonb) to authenticated;

-- Ajusta as validacoes das RPCs de capitulos para permitir que a numeracao
-- reinicie em cada Nivel, mantendo slug ativo globalmente unico.
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
  if v_actor_id is null or not public.is_healer_or_admin() then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;

  v_chapter_number := nullif(btrim(p_data->>'chapter_number'), '')::integer;
  v_title := nullif(btrim(p_data->>'title'), '');
  v_slug := lower(nullif(btrim(p_data->>'slug'), ''));
  v_level_number := nullif(btrim(p_data->>'level_number'), '')::integer;
  v_description := nullif(btrim(p_data->>'description'), '');
  v_objective := nullif(btrim(p_data->>'objective'), '');
  v_duration := nullif(btrim(p_data->>'estimated_duration_weeks'), '')::integer;
  v_display_order := coalesce(nullif(btrim(p_data->>'display_order'), '')::integer, 0);
  v_status := coalesce(nullif(lower(btrim(p_data->>'status')), ''), 'draft');

  if v_chapter_number is null or v_chapter_number <= 0 then raise exception 'INVALID_CHAPTER_NUMBER' using errcode='22023'; end if;
  if v_title is null or char_length(v_title) > 160 then raise exception 'INVALID_TITLE' using errcode='22023'; end if;
  if v_slug is null or char_length(v_slug) > 160 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG' using errcode='22023'; end if;
  if v_level_number is null or v_level_number <= 0 or not exists (select 1 from public.adventurer_levels l where l.level_number=v_level_number) then raise exception 'INVALID_LEVEL' using errcode='22023'; end if;
  if v_duration is null or v_duration <= 0 then raise exception 'INVALID_ESTIMATED_DURATION' using errcode='22023'; end if;
  if v_display_order < 0 then raise exception 'INVALID_DISPLAY_ORDER' using errcode='22023'; end if;
  if v_status not in ('draft','active','archived') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  if v_status='active' and exists (select 1 from public.chapters c where c.status='active' and c.level_number=v_level_number and c.chapter_number=v_chapter_number) then raise exception 'ACTIVE_CHAPTER_NUMBER_EXISTS' using errcode='23505'; end if;
  if v_status='active' and exists (select 1 from public.chapters c where c.status='active' and lower(c.slug)=v_slug) then raise exception 'ACTIVE_CHAPTER_SLUG_EXISTS' using errcode='23505'; end if;

  insert into public.chapters(chapter_number,title,slug,level_number,description,objective,estimated_duration_weeks,display_order,status,archived_at,created_by,updated_by,created_at,updated_at)
  values(v_chapter_number,v_title,v_slug,v_level_number,v_description,v_objective,v_duration,v_display_order,v_status,case when v_status='archived' then now() else null end,v_actor_id,v_actor_id,now(),now())
  returning * into v_chapter;
  insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,metadata)
  values(v_actor_id,'chapter_created','chapter',v_chapter.id,jsonb_build_object('chapter',to_jsonb(v_chapter)));
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
  v_chapter_number integer; v_title text; v_slug text; v_level_number integer;
  v_description text; v_objective text; v_duration integer; v_display_order integer; v_status text;
begin
  if v_actor_id is null or not public.is_healer_or_admin() then raise exception 'ACCESS_DENIED' using errcode='42501'; end if;
  if p_chapter_id is null or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'INVALID_INPUT' using errcode='22023'; end if;
  select * into v_before from public.chapters where id=p_chapter_id for update;
  if not found then raise exception 'CHAPTER_NOT_FOUND' using errcode='P0002'; end if;

  v_chapter_number := case when p_data?'chapter_number' then nullif(btrim(p_data->>'chapter_number'),'')::integer else v_before.chapter_number end;
  v_title := case when p_data?'title' then nullif(btrim(p_data->>'title'),'') else v_before.title end;
  v_slug := case when p_data?'slug' then lower(nullif(btrim(p_data->>'slug'),'')) else v_before.slug end;
  v_level_number := case when p_data?'level_number' then nullif(btrim(p_data->>'level_number'),'')::integer else v_before.level_number end;
  v_description := case when p_data?'description' then nullif(btrim(p_data->>'description'),'') else v_before.description end;
  v_objective := case when p_data?'objective' then nullif(btrim(p_data->>'objective'),'') else v_before.objective end;
  v_duration := case when p_data?'estimated_duration_weeks' then nullif(btrim(p_data->>'estimated_duration_weeks'),'')::integer else v_before.estimated_duration_weeks end;
  v_display_order := case when p_data?'display_order' then nullif(btrim(p_data->>'display_order'),'')::integer else v_before.display_order end;
  v_status := case when p_data?'status' then nullif(lower(btrim(p_data->>'status')),'') else v_before.status end;

  if v_chapter_number is null or v_chapter_number<=0 then raise exception 'INVALID_CHAPTER_NUMBER' using errcode='22023'; end if;
  if v_title is null or char_length(v_title)>160 then raise exception 'INVALID_TITLE' using errcode='22023'; end if;
  if v_slug is null or char_length(v_slug)>160 or v_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG' using errcode='22023'; end if;
  if v_level_number is null or v_level_number<=0 or not exists(select 1 from public.adventurer_levels l where l.level_number=v_level_number) then raise exception 'INVALID_LEVEL' using errcode='22023'; end if;
  if v_duration is null or v_duration<=0 then raise exception 'INVALID_ESTIMATED_DURATION' using errcode='22023'; end if;
  if v_display_order is null or v_display_order<0 then raise exception 'INVALID_DISPLAY_ORDER' using errcode='22023'; end if;
  if v_status not in ('draft','active','archived') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  if v_before.status='active' and v_status<>'active' and exists(select 1 from public.adventurer_journeys j where j.current_chapter_id=p_chapter_id and j.status in ('locked','active','paused')) then raise exception 'CHAPTER_IN_USE' using errcode='23503'; end if;
  if v_status='active' and exists(select 1 from public.chapters c where c.id<>p_chapter_id and c.status='active' and c.level_number=v_level_number and c.chapter_number=v_chapter_number) then raise exception 'ACTIVE_CHAPTER_NUMBER_EXISTS' using errcode='23505'; end if;
  if v_status='active' and exists(select 1 from public.chapters c where c.id<>p_chapter_id and c.status='active' and lower(c.slug)=v_slug) then raise exception 'ACTIVE_CHAPTER_SLUG_EXISTS' using errcode='23505'; end if;

  update public.chapters set chapter_number=v_chapter_number,title=v_title,slug=v_slug,level_number=v_level_number,description=v_description,objective=v_objective,estimated_duration_weeks=v_duration,display_order=v_display_order,status=v_status,archived_at=case when v_status='archived' then coalesce(v_before.archived_at,now()) else null end,updated_by=v_actor_id,updated_at=now()
  where id=p_chapter_id returning * into v_after;
  insert into public.admin_audit_logs(actor_id,action,resource_type,resource_id,metadata)
  values(v_actor_id,'chapter_updated','chapter',v_after.id,jsonb_build_object('before',to_jsonb(v_before),'after',to_jsonb(v_after)));
  return to_jsonb(v_after);
end;
$function$;

revoke all on function public.update_chapter(uuid, jsonb) from public, anon;
grant execute on function public.update_chapter(uuid, jsonb) to authenticated;
