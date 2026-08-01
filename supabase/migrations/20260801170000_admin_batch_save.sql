-- Atomic batch save for the admin panel's editable tables.
--
-- Why a database function: PostgREST issues one statement per request, so a
-- batch of UPDATEs + INSERTs sent over REST would apply partially if one failed.
-- A single function call runs inside ONE transaction, so any exception rolls the
-- whole batch back. That all-or-nothing guarantee is required here because these
-- are financial records.
--
-- SECURITY DEFINER is needed to run the writes, which means RLS is bypassed
-- inside the body — so the function checks the admin role itself, first thing,
-- and only accepts a fixed whitelist of tables.

create or replace function public.admin_save_table_changes(
  p_table text,
  p_updates jsonb default '[]'::jsonb,
  p_inserts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- `users` is deliberately absent: roles are never editable from the panel.
  allowed_tables constant text[] := array[
    'projects', 'investors', 'capital_contributions', 'budget_items',
    'tasks', 'monthly_reports', 'documents', 'reassignment_requests',
    'investment_interests'
  ];
  v_change    jsonb;
  v_values    jsonb;
  v_id        uuid;
  v_key       text;
  v_set       text;
  v_cols      text;
  v_vals      text;
  v_updated   integer := 0;
  v_inserted  integer := 0;
begin
  if not public.is_admin() then
    raise exception 'No autorizado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if p_table is null or not (p_table = any(allowed_tables)) then
    raise exception 'Tabla no permitida: %', coalesce(p_table, 'null')
      using errcode = '42501';
  end if;

  ---------------------------------------------------------------- updates --
  for v_change in
    select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    v_id := nullif(v_change ->> 'id', '')::uuid;
    v_values := coalesce(v_change -> 'values', '{}'::jsonb);

    if v_id is null then
      raise exception 'Se recibió una actualización sin identificador';
    end if;

    -- Every key must be a real column: blocks writes to anything invented by
    -- a hand-crafted payload.
    for v_key in select jsonb_object_keys(v_values)
    loop
      if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = p_table
          and column_name = v_key
      ) then
        raise exception 'La columna % no existe en %', v_key, p_table;
      end if;
    end loop;

    select string_agg(format('%I = %L', key, value), ', ')
      into v_set
      from jsonb_each_text(v_values);

    if v_set is not null then
      execute format(
        'update public.%I set %s, updated_at = now() where id = %L',
        p_table, v_set, v_id
      );
      v_updated := v_updated + 1;
    end if;
  end loop;

  ---------------------------------------------------------------- inserts --
  for v_change in
    select * from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb))
  loop
    if v_change = '{}'::jsonb then
      continue;
    end if;

    for v_key in select jsonb_object_keys(v_change)
    loop
      if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = p_table
          and column_name = v_key
      ) then
        raise exception 'La columna % no existe en %', v_key, p_table;
      end if;
    end loop;

    select string_agg(format('%I', key), ', '),
           string_agg(format('%L', value), ', ')
      into v_cols, v_vals
      from jsonb_each_text(v_change);

    execute format(
      'insert into public.%I (%s) values (%s)', p_table, v_cols, v_vals
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'inserted', v_inserted);
end;
$$;

-- Only signed-in users may even call it; the body then demands the admin role.
revoke all on function public.admin_save_table_changes(text, jsonb, jsonb) from public;
revoke all on function public.admin_save_table_changes(text, jsonb, jsonb) from anon;
grant execute on function public.admin_save_table_changes(text, jsonb, jsonb) to authenticated;
