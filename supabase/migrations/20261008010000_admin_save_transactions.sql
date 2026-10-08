-- Autoriza `transactions` en el guardado por lotes del panel.
--
-- POR QUÉ: los montos que ve el inversionista en su portal (Inicio, Mis
-- inversiones, capital vigente) se calculan desde public.transactions —no
-- desde capital_contributions, que guarda el compromiso y sus condiciones—.
-- El panel no tenía pestaña para esa tabla, así que los movimientos se venían
-- cargando a mano desde el editor de Supabase. Con la pestaña nueva
-- ("Transacciones") el guardado pasa por esta función, y la función rechaza
-- cualquier tabla que no esté en su lista blanca.
--
-- Es el ÚNICO cambio: se vuelve a crear la función idéntica a la de
-- 20260801170000_admin_batch_save.sql con 'transactions' añadido al array.
-- Sigue siendo SECURITY DEFINER y sigue exigiendo public.is_admin() antes de
-- tocar nada.
--
-- RLS de la tabla: ya existía y no se toca. transactions_select_own deja leer
-- al admin y a cada inversionista lo suyo; transactions_admin_write limita la
-- escritura a public.is_admin() (20260730001158_rls_policies.sql).
--
-- NO se inserta, actualiza ni borra ninguna fila.

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
    'investment_interests', 'transactions'
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

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- Volver a ejecutar 20260801170000_admin_batch_save.sql, que define la misma
-- función sin 'transactions' en la lista blanca.
