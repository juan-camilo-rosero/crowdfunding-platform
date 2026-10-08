-- Borrado de UNA fila desde el panel de administración.
--
-- El guardado por lotes (admin_save_table_changes) solo inserta y actualiza:
-- para corregir un movimiento mal cargado había que entrar al editor de
-- Supabase. Esta función agrega el borrado, con una lista blanca PROPIA y más
-- corta que la del guardado.
--
-- QUÉ SE PUEDE BORRAR, y por qué solo eso (claves foráneas reales del esquema):
--   · transactions, budget_items, tasks, monthly_reports,
--     investment_interests  -> son hojas: nada las referencia.
--   · capital_contributions, documents -> solo las referencia signing_requests,
--     con ON DELETE SET NULL: la firma sobrevive y pierde el enlace.
--   · reassignment_requests -> hoja también, PERO una aprobada no se toca: su
--     capital ya se movió (investor_project_position lo lee de ahí) y su
--     transacción ya existe. Borrarla devolvería dinero sin rastro.
--
-- QUÉ NUNCA: projects e investors. Borrar un proyecto arrastra en cascada su
-- presupuesto, sus tareas, sus reportes y los intereses recibidos; borrar un
-- inversionista arrastra sus tickets y sus firmas, y la base lo rechaza de
-- plano cuando tiene dinero asociado. Para retirarlos está su campo de estado.
--
-- SECURITY DEFINER como su hermana, así que lo primero que hace es exigir el
-- rol de administrador. El id viaja como uuid tipado, no como texto
-- interpolado.

create or replace function public.admin_delete_table_row(
  p_table text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- MÁS CORTA que la de admin_save_table_changes, a propósito.
  deletable_tables constant text[] := array[
    'transactions', 'budget_items', 'tasks', 'monthly_reports',
    'documents', 'investment_interests', 'capital_contributions',
    'reassignment_requests'
  ];
  v_status  text;
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'No autorizado: se requiere rol de administrador'
      using errcode = '42501';
  end if;

  if p_table is null or not (p_table = any(deletable_tables)) then
    raise exception 'Esta tabla no permite eliminar registros: %',
      coalesce(p_table, 'null')
      using errcode = '42501';
  end if;

  if p_id is null then
    raise exception 'Se recibió un borrado sin identificador';
  end if;

  -- Una solicitud aprobada ya movió capital: no se borra ni con rol de admin.
  if p_table = 'reassignment_requests' then
    select status into v_status
      from public.reassignment_requests
     where id = p_id;

    if v_status = 'aprobada' then
      raise exception 'No se puede eliminar una solicitud aprobada'
        using errcode = '42501';
    end if;
  end if;

  execute format('delete from public.%I where id = %L', p_table, p_id);
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- Solo usuarios autenticados pueden llamarla; el cuerpo exige además el rol.
revoke all on function public.admin_delete_table_row(text, uuid) from public;
revoke all on function public.admin_delete_table_row(text, uuid) from anon;
grant execute on function public.admin_delete_table_row(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- drop function if exists public.admin_delete_table_row(text, uuid);
