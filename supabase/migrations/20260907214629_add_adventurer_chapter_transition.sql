-- EVOLVE Quest: transicao administrativa de capitulo.
-- Preserva a Jornada e todos os registros relacionados; somente os ponteiros do
-- capitulo atual e o progresso derivado do capitulo selecionado sao atualizados.

create index if not exists journey_progressions_chapter_transition_lookup_idx
  on public.journey_progressions (adventurer_id, new_chapter_id, approved_at desc)
  where status = 'approved' and approved_at is not null;

create or replace function public.get_healer_journey_management(p_adventurer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile public.profiles%rowtype;
  v_journey public.adventurer_journeys%rowtype;
  v_chapter public.chapters%rowtype;
  v_chapter_started_at timestamptz;
  v_chapters jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_healer_or_admin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if not public.can_manage_adventurer(p_adventurer_id) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_adventurer_id and role = 'adventurer';

  if not found then
    raise exception 'ADVENTURER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_journey
  from public.adventurer_journeys
  where adventurer_id = p_adventurer_id
    and status in ('locked', 'active', 'paused')
  order by (status = 'active') desc, created_at desc
  limit 1;

  if v_journey.id is not null then
    select * into v_chapter
    from public.chapters
    where id = v_journey.current_chapter_id;

    select coalesce(
      (
        select max(jp.approved_at)
        from public.journey_progressions jp
        where jp.adventurer_id = p_adventurer_id
          and jp.previous_journey_id = v_journey.id
          and jp.new_chapter_id = v_journey.current_chapter_id
          and jp.status = 'approved'
          and jp.approved_at is not null
      ),
      v_journey.started_at,
      v_journey.created_at
    ) into v_chapter_started_at;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'chapter_number', c.chapter_number,
        'level_number', c.level_number,
        'status', c.status
      ) order by c.display_order, c.chapter_number, c.title
    ),
    '[]'::jsonb
  ) into v_chapters
  from public.chapters c
  where c.status = 'active';

  return jsonb_build_object(
    'adventurerId', v_profile.id,
    'journey', case when v_journey.id is null then null else jsonb_build_object(
      'id', v_journey.id,
      'status', v_journey.status,
      'currentLevel', coalesce(v_journey.current_level, v_profile.current_level),
      'currentChapterId', v_journey.current_chapter_id,
      'chapterProgress', v_journey.chapter_progress,
      'chapterStartedAt', v_chapter_started_at
    ) end,
    'currentChapter', case when v_chapter.id is null then null else jsonb_build_object(
      'id', v_chapter.id,
      'title', v_chapter.title,
      'chapterNumber', v_chapter.chapter_number,
      'levelNumber', v_chapter.level_number
    ) end,
    'chapters', v_chapters
  );
end;
$function$;

revoke all on function public.get_healer_journey_management(uuid) from public, anon;
grant execute on function public.get_healer_journey_management(uuid) to authenticated;

create or replace function public.change_adventurer_chapter(
  p_adventurer_id uuid,
  p_new_chapter_id uuid,
  p_observation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_journey public.adventurer_journeys%rowtype;
  v_previous_chapter public.chapters%rowtype;
  v_new_chapter public.chapters%rowtype;
  v_transition_id uuid;
  v_changed_at timestamptz := clock_timestamp();
  v_observation text := nullif(btrim(p_observation), '');
  v_planned integer;
  v_completed integer;
  v_progress integer;
begin
  if v_actor_id is null or not public.is_healer_or_admin() then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_adventurer_id is null or p_new_chapter_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if v_observation is not null and char_length(v_observation) > 1000 then
    raise exception 'OBSERVATION_TOO_LONG' using errcode = '22001';
  end if;

  if not public.can_manage_adventurer(p_adventurer_id) then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_adventurer_id and role = 'adventurer'
  for update;

  if not found then
    raise exception 'ADVENTURER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_journey
  from public.adventurer_journeys
  where adventurer_id = p_adventurer_id
    and status in ('locked', 'active', 'paused')
  order by (status = 'active') desc, created_at desc
  limit 1
  for update;

  if v_journey.id is null then
    raise exception 'CURRENT_JOURNEY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_new_chapter
  from public.chapters
  where id = p_new_chapter_id and status = 'active';

  if not found then
    raise exception 'INVALID_OR_INACTIVE_CHAPTER' using errcode = '22023';
  end if;

  if v_journey.current_chapter_id = p_new_chapter_id then
    raise exception 'CHAPTER_UNCHANGED' using errcode = '22023';
  end if;

  if v_journey.current_chapter_id is not null then
    select * into v_previous_chapter
    from public.chapters
    where id = v_journey.current_chapter_id;
  end if;

  v_planned := greatest(
    1,
    coalesce(
      v_journey.planned_sessions,
      v_journey.prescribed_frequency * v_journey.chapter_duration_weeks,
      1
    )
  );

  select count(*) into v_completed
  from public.mission_registrations mr
  where mr.journey_id = v_journey.id
    and mr.chapter_id = p_new_chapter_id
    and mr.completion_status = 'completed';

  v_progress := least(100, round((v_completed::numeric / v_planned::numeric) * 100)::integer);

  insert into public.journey_progressions (
    adventurer_id,
    previous_journey_id,
    previous_chapter_id,
    healer_id,
    status,
    decision_type,
    previous_level,
    new_level,
    new_chapter_id,
    decision_reason,
    started_at,
    approved_at,
    created_at,
    updated_at
  ) values (
    p_adventurer_id,
    v_journey.id,
    v_journey.current_chapter_id,
    v_actor_id,
    'approved',
    'chapter_transition',
    v_journey.current_level,
    v_journey.current_level,
    p_new_chapter_id,
    v_observation,
    v_changed_at,
    v_changed_at,
    v_changed_at,
    v_changed_at
  ) returning id into v_transition_id;

  update public.adventurer_journeys
  set current_chapter_id = p_new_chapter_id,
      chapter_progress = v_progress,
      updated_at = v_changed_at
  where id = v_journey.id;

  update public.profiles
  set current_chapter_id = p_new_chapter_id,
      updated_at = v_changed_at
  where id = p_adventurer_id;

  insert into public.admin_audit_logs (
    actor_id,
    action,
    resource_type,
    resource_id,
    created_at,
    metadata
  ) values (
    v_actor_id,
    'adventurer_chapter_transitioned',
    'adventurer_journey',
    v_journey.id,
    v_changed_at,
    jsonb_build_object(
      'adventurer_id', p_adventurer_id,
      'journey_id', v_journey.id,
      'transition_id', v_transition_id,
      'previous_chapter_id', v_previous_chapter.id,
      'previous_chapter_number', v_previous_chapter.chapter_number,
      'previous_chapter_title', v_previous_chapter.title,
      'new_chapter_id', v_new_chapter.id,
      'new_chapter_number', v_new_chapter.chapter_number,
      'new_chapter_title', v_new_chapter.title,
      'actor_id', v_actor_id,
      'observation', v_observation,
      'transitioned_at', v_changed_at
    )
  );

  return jsonb_build_object(
    'success', true,
    'adventurerId', p_adventurer_id,
    'journeyId', v_journey.id,
    'transitionId', v_transition_id,
    'previousChapter', jsonb_build_object(
      'id', v_previous_chapter.id,
      'number', v_previous_chapter.chapter_number,
      'title', v_previous_chapter.title
    ),
    'newChapter', jsonb_build_object(
      'id', v_new_chapter.id,
      'number', v_new_chapter.chapter_number,
      'title', v_new_chapter.title
    ),
    'chapterStartedAt', v_changed_at,
    'chapterProgress', v_progress
  );
end;
$function$;

revoke all on function public.change_adventurer_chapter(uuid, uuid, text) from public, anon;
grant execute on function public.change_adventurer_chapter(uuid, uuid, text) to authenticated;

create or replace function public.recompute_journey_chapter_progress(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_planned integer;
  v_completed integer;
  v_progress integer;
  v_chapter_id uuid;
begin
  select
    greatest(1, coalesce(planned_sessions, prescribed_frequency * chapter_duration_weeks, 1)),
    current_chapter_id
  into v_planned, v_chapter_id
  from public.adventurer_journeys
  where id = p_journey_id;

  if v_planned is null then return; end if;

  select count(*) into v_completed
  from public.mission_registrations
  where journey_id = p_journey_id
    and chapter_id = v_chapter_id
    and completion_status = 'completed';

  v_progress := least(100, round((v_completed::numeric / v_planned::numeric) * 100)::integer);

  update public.adventurer_journeys
  set chapter_progress = v_progress,
      updated_at = now()
  where id = p_journey_id;
end;
$function$;

revoke all on function public.recompute_journey_chapter_progress(uuid) from public, anon, authenticated;

create or replace function public.get_my_adventurer_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_journey jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_checkpoint jsonb;
  v_subscription jsonb;
  v_evaluation jsonb;
  v_healer jsonb;
  v_records jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode='42501';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'preferred_name', p.preferred_name,
    'account_status', p.account_status,
    'access_status', p.access_status,
    'profile_status', p.profile_status,
    'journey_stage', p.journey_stage,
    'current_level', p.current_level,
    'class_id', p.class_id,
    'class_name', c.name,
    'current_chapter_id', p.current_chapter_id,
    'chapter_title', ch.title,
    'chapter_number', ch.chapter_number,
    'healer_id', p.healer_id
  ) into v_profile
  from public.profiles p
  left join public.adventurer_classes c on c.id = p.class_id
  left join public.chapters ch on ch.id = p.current_chapter_id
  where p.id = v_uid;

  if v_profile is null then
    raise exception 'profile_not_found' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'id', j.id,
    'status', j.status,
    'current_chapter_id', j.current_chapter_id,
    'current_level', j.current_level,
    'xp_enabled', j.xp_enabled,
    'total_xp', j.total_xp,
    'chapter_progress', j.chapter_progress,
    'current_streak', j.current_streak,
    'started_at', j.started_at,
    'chapter_title', ch.title,
    'chapter_number', ch.chapter_number
  ) into v_journey
  from public.adventurer_journeys j
  left join public.chapters ch on ch.id = j.current_chapter_id
  where j.adventurer_id = v_uid
    and j.status in ('locked','active','paused')
  order by (j.status = 'active') desc, j.created_at desc
  limit 1;

  if v_journey is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ma.id,
      'journey_id', ma.journey_id,
      'chapter_id', ma.chapter_id,
      'mission_id', ma.mission_id,
      'mission_type', ma.mission_type,
      'status', ma.status,
      'available_at', ma.available_at,
      'completed_at', ma.completed_at,
      'mission', jsonb_build_object(
        'name', m.name,
        'subtitle', m.subtitle,
        'objective', m.objective,
        'estimated_duration_minutes', m.estimated_duration_minutes,
        'mission_type', m.mission_type,
        'environment', m.environment
      )
    ) order by ma.created_at), '[]'::jsonb)
    into v_assignments
    from public.mission_assignments ma
    join public.missions m on m.id = ma.mission_id
    where ma.adventurer_id = v_uid
      and ma.journey_id = (v_journey->>'id')::uuid
      and ma.chapter_id = (v_journey->>'current_chapter_id')::uuid;
  end if;

  select to_jsonb(x) into v_checkpoint
  from (
    select id, journey_id, status, available_at, due_at, completed_at
    from public.checkpoint_assignments
    where adventurer_id = v_uid
      and status in ('available','in_progress')
    order by due_at asc nulls last
    limit 1
  ) x;

  select to_jsonb(x) into v_subscription
  from (
    select id, plan_id, status, payment_status, current_period_end
    from public.subscriptions
    where adventurer_id = v_uid
    order by created_at desc
    limit 1
  ) x;

  select to_jsonb(x) into v_evaluation
  from (
    select id, status, completion_percentage, submitted_at, analysis_started_at
    from public.initial_evaluations
    where adventurer_id = v_uid
    order by created_at desc
    limit 1
  ) x;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into v_records
  from (
    select id, mission_assignment_id, status, started_at, completed_at, submitted_at, xp_awarded, created_at
    from public.mission_records
    where adventurer_id = v_uid
      and created_at >= now() - interval '7 days'
  ) r;

  if (v_profile->>'healer_id') is not null then
    select jsonb_build_object(
      'id', hp.id,
      'display_name', hp.display_name,
      'contact_url', hp.contact_url,
      'whatsapp_number', hp.whatsapp_number,
      'status', hp.status
    ) into v_healer
    from public.healer_profiles hp
    where hp.id = (v_profile->>'healer_id')::uuid
    limit 1;
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'journey', v_journey,
    'assignments', v_assignments,
    'checkpoint', v_checkpoint,
    'subscription', v_subscription,
    'evaluation', v_evaluation,
    'records', v_records,
    'healer', v_healer
  );
end;
$function$;

revoke all on function public.get_my_adventurer_dashboard() from public, anon;
grant execute on function public.get_my_adventurer_dashboard() to authenticated;

create or replace function public.get_my_journey_map()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_journey public.adventurer_journeys%rowtype;
  v_chapter public.chapters%rowtype;
  v_class_name text;
  v_healer_name text;
  v_total_records integer := 0;
  v_completed_records integer := 0;
  v_attention_records integer := 0;
  v_checkpoint jsonb;
  v_records jsonb := '[]'::jsonb;
  v_weekly jsonb := '[]'::jsonb;
  v_achievements jsonb := '[]'::jsonb;
  v_next_milestone text;
  v_progress integer := 0;
  v_chapter_started_at timestamptz;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;

  select * into v_profile from public.profiles where id=v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_journey
  from public.adventurer_journeys
  where adventurer_id=v_uid and status in ('active','paused','locked')
  order by (status = 'active') desc, created_at desc limit 1;

  if v_journey.id is not null then
    select * into v_chapter from public.chapters where id=v_journey.current_chapter_id;
    v_progress := coalesce(v_journey.chapter_progress,0);

    select coalesce(
      (
        select max(jp.approved_at)
        from public.journey_progressions jp
        where jp.adventurer_id = v_uid
          and jp.previous_journey_id = v_journey.id
          and jp.new_chapter_id = v_journey.current_chapter_id
          and jp.status = 'approved'
          and jp.approved_at is not null
      ),
      v_journey.started_at,
      v_journey.created_at
    ) into v_chapter_started_at;
  end if;

  select name into v_class_name from public.adventurer_classes where id=v_profile.class_id;
  select display_name into v_healer_name from public.healer_profiles where id=v_profile.healer_id;

  select count(*),
         count(*) filter(where completion_status='completed'),
         count(*) filter(where requires_healer_attention)
  into v_total_records,v_completed_records,v_attention_records
  from public.mission_registrations
  where adventurer_id=v_uid
    and (v_journey.id is null or journey_id=v_journey.id)
    and (v_journey.current_chapter_id is null or chapter_id=v_journey.current_chapter_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'missionName',coalesce(m.name,'Missão'),
    'missionSubtitle',m.subtitle,
    'missionType',m.mission_type,
    'environment',m.environment,
    'completionStatus',r.completion_status,
    'submittedAt',r.submitted_at,
    'perceivedEffort',r.perceived_effort,
    'technicalExecution',r.technical_execution,
    'requiresHealerAttention',r.requires_healer_attention
  ) order by r.submitted_at desc),'[]'::jsonb)
  into v_records
  from public.mission_registrations r
  left join public.missions m on m.id=r.mission_id
  where r.adventurer_id=v_uid
    and (v_journey.id is null or r.journey_id=v_journey.id)
    and (v_journey.current_chapter_id is null or r.chapter_id=v_journey.current_chapter_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'weekNumber',wp.week_number,
    'missionsCompleted',wp.missions_completed,
    'missionsPartiallyCompleted',wp.missions_partially_completed,
    'missionsNotCompleted',wp.missions_not_completed,
    'weeklyGoal',wp.weekly_goal,
    'progressPercentage',wp.progress_percentage,
    'lastMissionAt',wp.last_mission_at
  ) order by wp.week_number),'[]'::jsonb)
  into v_weekly
  from public.weekly_progress wp
  where wp.adventurer_id=v_uid
    and (v_journey.id is null or wp.journey_id=v_journey.id)
    and (v_journey.current_chapter_id is null or wp.chapter_id=v_journey.current_chapter_id);

  select jsonb_build_object(
    'id',c.id,'status',c.status,'availableAt',c.available_at,'dueAt',c.due_at,'completedAt',c.completed_at
  ) into v_checkpoint
  from public.checkpoint_assignments c
  where c.adventurer_id=v_uid and (v_journey.id is null or c.journey_id=v_journey.id)
  order by c.created_at desc limit 1;

  if exists(select 1 from public.initial_evaluations where adventurer_id=v_uid and status='approved') then
    v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','journey_released','title','Jornada Liberada','description','Sua avaliação foi analisada e sua primeira Jornada foi liberada.','unlocked',true));
  end if;
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','first_mission','title','Primeiro Passo','description','Concluir e registrar sua primeira Missão.','unlocked',v_completed_records>=1));
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','quarter','title','Marco de 25%','description','Completar um quarto do Capítulo atual.','unlocked',v_progress>=25));
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','half','title','Metade da Travessia','description','Alcançar 50% do Capítulo atual.','unlocked',v_progress>=50));
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','three_quarters','title','Reta Final','description','Alcançar 75% do Capítulo atual.','unlocked',v_progress>=75));
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','chapter_complete','title','Capítulo Concluído','description','Completar 100% das sessões planejadas do Capítulo.','unlocked',v_progress>=100));
  v_achievements := v_achievements || jsonb_build_array(jsonb_build_object('key','checkpoint','title','Checkpoint','description','Concluir o Checkpoint do Capítulo.','unlocked',coalesce(v_checkpoint->>'status','')='completed'));

  v_next_milestone := case
    when v_progress < 25 then 'Alcançar 25% do Capítulo'
    when v_progress < 50 then 'Alcançar 50% do Capítulo'
    when v_progress < 75 then 'Alcançar 75% do Capítulo'
    when v_progress < 100 then 'Concluir 100% do Capítulo'
    when coalesce(v_checkpoint->>'status','') <> 'completed' then 'Concluir o Checkpoint'
    else 'Aguardar a Progressão para o próximo Capítulo'
  end;

  return jsonb_build_object(
    'profile',jsonb_build_object(
      'fullName',v_profile.full_name,'preferredName',v_profile.preferred_name,'className',v_class_name,
      'currentLevel',coalesce(v_journey.current_level,v_profile.current_level),'healerName',v_healer_name
    ),
    'journey',jsonb_build_object(
      'id',v_journey.id,'status',v_journey.status,'startedAt',v_chapter_started_at,
      'chapterProgress',v_progress,'prescribedFrequency',v_journey.prescribed_frequency,
      'chapterDurationWeeks',v_journey.chapter_duration_weeks,'plannedSessions',v_journey.planned_sessions,
      'completedSessions',v_completed_records,'totalXp',v_journey.total_xp,'currentStreak',v_journey.current_streak
    ),
    'chapter',jsonb_build_object('id',v_chapter.id,'number',v_chapter.chapter_number,'title',v_chapter.title,'objective',v_chapter.objective),
    'checkpoint',coalesce(v_checkpoint,'null'::jsonb),
    'records',v_records,
    'weeklyProgress',v_weekly,
    'achievements',v_achievements,
    'summary',jsonb_build_object('totalRecords',v_total_records,'completedRecords',v_completed_records,'attentionRecords',v_attention_records,'nextMilestone',v_next_milestone)
  );
end;
$function$;

revoke all on function public.get_my_journey_map() from public, anon;
grant execute on function public.get_my_journey_map() to authenticated;
