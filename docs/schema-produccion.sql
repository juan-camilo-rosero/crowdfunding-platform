


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_save_table_changes"("p_table" "text", "p_updates" "jsonb" DEFAULT '[]'::"jsonb", "p_inserts" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."admin_save_table_changes"("p_table" "text", "p_updates" "jsonb", "p_inserts" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_project_stake"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.capital_contributions cc
    join public.investors i on i.id = cc.investor_id
    where cc.project_id = p_project_id
      and i.user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.transactions t
    join public.investors i on i.id = t.investor_id
    where t.project_id = p_project_id
      and i.user_id = (select auth.uid())
  );
$$;


ALTER FUNCTION "public"."has_project_stake"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_project_stake"("p_project_id" "uuid") IS 'True when the CURRENT user holds a stake in the given project, through a capital contribution or a transaction. SECURITY DEFINER so the check does not depend on the caller''s own RLS over those tables; it always resolves auth.uid() itself and cannot be pointed at somebody else.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "description" "text",
    "category" "text",
    "approved_budget" numeric(14,2),
    "actual_spent" numeric(14,2),
    "spent_date" "date",
    "vendor" "text",
    "paid_status" "text",
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "budget_items_category_check" CHECK (("category" = ANY (ARRAY['lote'::"text", 'closing costs'::"text", 'survey'::"text", 'arquitectura'::"text", 'ingeniería'::"text", 'permisos'::"text", 'impact fees'::"text", 'site work'::"text", 'utilities'::"text", 'construcción'::"text", 'piscina'::"text", 'landscaping'::"text", 'marketing'::"text", 'realtor'::"text", 'contingencia'::"text", 'administración'::"text"]))),
    CONSTRAINT "budget_items_paid_status_check" CHECK (("paid_status" = ANY (ARRAY['pagado'::"text", 'pendiente'::"text"])))
);


ALTER TABLE "public"."budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."capital_contributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text",
    "project_id" "uuid",
    "investor_id" "uuid",
    "amount_required" numeric(14,2),
    "amount_committed" numeric(14,2),
    "amount_received" numeric(14,2),
    "received_date" "date",
    "bank_account" "text",
    "capital_type" "text",
    "agreed_return" "text",
    "term" "text",
    "status" "text",
    "comments" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "capital_contributions_capital_type_check" CHECK (("capital_type" = ANY (ARRAY['equity'::"text", 'deuda'::"text", 'préstamo'::"text", 'socio'::"text"]))),
    CONSTRAINT "capital_contributions_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'recibido'::"text", 'usado'::"text", 'devuelto'::"text"])))
);


ALTER TABLE "public"."capital_contributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "investor_id" "uuid",
    "name" "text",
    "doc_type" "text",
    "date" "date",
    "responsible" "text",
    "file_url" "text",
    "status" "text",
    "visibility" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['deed'::"text", 'property record'::"text", 'survey'::"text", 'planos'::"text", 'permisos'::"text", 'presupuesto'::"text", 'contrato'::"text", 'operating agreement'::"text", 'facturas'::"text", 'estados de cuenta'::"text", 'reportes'::"text", 'certificado de aporte'::"text"]))),
    CONSTRAINT "documents_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'recibido'::"text", 'aprobado'::"text", 'vencido'::"text"]))),
    CONSTRAINT "documents_visibility_check" CHECK (("visibility" = ANY (ARRAY['privado'::"text", 'proyecto'::"text", 'público'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."identity_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "truora_process_id" "text",
    "status" "text",
    "decline_reason" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "identity_verifications_status_check" CHECK (("status" = ANY (ARRAY['iniciado'::"text", 'aprobado'::"text", 'rechazado'::"text", 'expirado'::"text"])))
);


ALTER TABLE "public"."identity_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."investment_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "project_id" "uuid",
    "amount" numeric(14,2),
    "investment_type_pref" "text",
    "comments" "text",
    "phone" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "investment_interests_investment_type_pref_check" CHECK (("investment_type_pref" = ANY (ARRAY['equity'::"text", 'deuda'::"text", 'préstamo'::"text", 'socio'::"text", 'no estoy seguro'::"text"]))),
    CONSTRAINT "investment_interests_status_check" CHECK (("status" = ANY (ARRAY['nuevo'::"text", 'contactado'::"text", 'cerrado'::"text"])))
);


ALTER TABLE "public"."investment_interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reassignment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investor_id" "uuid",
    "from_project_id" "uuid",
    "to_project_id" "uuid",
    "amount" numeric(14,2),
    "status" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "reassignment_requests_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'aprobada'::"text", 'rechazada'::"text"])))
);


ALTER TABLE "public"."reassignment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investor_id" "uuid",
    "project_id" "uuid",
    "type" "text",
    "amount" numeric(14,2),
    "date" "date",
    "capital_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['aporte'::"text", 'rendimiento'::"text", 'devolución de capital'::"text", 'reasignación'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."investor_project_position" WITH ("security_invoker"='true') AS
 WITH "movements" AS (
         SELECT "t"."investor_id",
            "t"."project_id",
            COALESCE("sum"("t"."amount") FILTER (WHERE ("t"."type" = 'aporte'::"text")), (0)::numeric) AS "contributed",
            COALESCE("sum"("t"."amount") FILTER (WHERE ("t"."type" = 'devolución de capital'::"text")), (0)::numeric) AS "returned_capital",
            COALESCE("sum"("t"."amount") FILTER (WHERE ("t"."type" = 'rendimiento'::"text")), (0)::numeric) AS "yield_received"
           FROM "public"."transactions" "t"
          WHERE (("t"."investor_id" IS NOT NULL) AND ("t"."project_id" IS NOT NULL))
          GROUP BY "t"."investor_id", "t"."project_id"
        ), "reassignments" AS (
         SELECT "moves"."investor_id",
            "moves"."project_id",
            "sum"("moves"."delta") AS "net_reassigned"
           FROM ( SELECT "reassignment_requests"."investor_id",
                    "reassignment_requests"."to_project_id" AS "project_id",
                    "reassignment_requests"."amount" AS "delta"
                   FROM "public"."reassignment_requests"
                  WHERE (("reassignment_requests"."status" = 'aprobada'::"text") AND ("reassignment_requests"."to_project_id" IS NOT NULL))
                UNION ALL
                 SELECT "reassignment_requests"."investor_id",
                    "reassignment_requests"."from_project_id" AS "project_id",
                    (- "reassignment_requests"."amount") AS "delta"
                   FROM "public"."reassignment_requests"
                  WHERE (("reassignment_requests"."status" = 'aprobada'::"text") AND ("reassignment_requests"."from_project_id" IS NOT NULL))) "moves"
          WHERE ("moves"."investor_id" IS NOT NULL)
          GROUP BY "moves"."investor_id", "moves"."project_id"
        )
 SELECT COALESCE("m"."investor_id", "r"."investor_id") AS "investor_id",
    COALESCE("m"."project_id", "r"."project_id") AS "project_id",
    COALESCE("m"."contributed", (0)::numeric) AS "contributed",
    COALESCE("m"."returned_capital", (0)::numeric) AS "returned_capital",
    COALESCE("m"."yield_received", (0)::numeric) AS "yield_received",
    ((COALESCE("m"."contributed", (0)::numeric) - COALESCE("m"."returned_capital", (0)::numeric)) + COALESCE("r"."net_reassigned", (0)::numeric)) AS "current_capital"
   FROM ("movements" "m"
     FULL JOIN "reassignments" "r" ON ((("r"."investor_id" = "m"."investor_id") AND ("r"."project_id" = "m"."project_id"))));


ALTER VIEW "public"."investor_project_position" OWNER TO "postgres";


COMMENT ON VIEW "public"."investor_project_position" IS 'Base positions per investor and project. current_capital = contributed - returned + net reassignments. Includes closed positions.';



CREATE TABLE IF NOT EXISTS "public"."investors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "document_id" "text",
    "phone" "text",
    "email" "text",
    "city_country" "text",
    "potential_amount" numeric(14,2),
    "pipeline_stage" "text",
    "investment_type_pref" "text",
    "first_contact_date" "date",
    "last_contact_date" "date",
    "status" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "investors_investment_type_pref_check" CHECK (("investment_type_pref" = ANY (ARRAY['deuda'::"text", 'equity'::"text", 'socio'::"text", 'préstamo'::"text", 'participación'::"text"]))),
    CONSTRAINT "investors_pipeline_stage_check" CHECK (("pipeline_stage" = ANY (ARRAY['contacto'::"text", 'calificado'::"text", 'en reunión'::"text", 'en revisión'::"text", 'firmado'::"text", 'desembolsado'::"text"]))),
    CONSTRAINT "investors_status_check" CHECK (("status" = ANY (ARRAY['prospecto'::"text", 'interesado'::"text", 'en revisión'::"text", 'comprometido'::"text", 'recibido'::"text", 'pausado'::"text"])))
);


ALTER TABLE "public"."investors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."investor_financial_summary" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "investor_id",
    COALESCE("sum"("p"."contributed"), (0)::numeric) AS "total_contributed",
    (COALESCE("sum"("p"."contributed"), (0)::numeric) - COALESCE("sum"("p"."returned_capital"), (0)::numeric)) AS "current_capital",
    COALESCE("sum"("p"."returned_capital"), (0)::numeric) AS "capital_returned",
    COALESCE("sum"("p"."yield_received"), (0)::numeric) AS "yield_received",
    "count"(DISTINCT "p"."project_id") FILTER (WHERE ("p"."current_capital" > (0)::numeric)) AS "active_projects_count",
    "round"(((COALESCE("sum"("p"."yield_received") FILTER (WHERE (("p"."contributed" > (0)::numeric) AND ("p"."returned_capital" >= "p"."contributed"))), (0)::numeric) * (100)::numeric) / NULLIF("sum"("p"."contributed") FILTER (WHERE (("p"."contributed" > (0)::numeric) AND ("p"."returned_capital" >= "p"."contributed"))), (0)::numeric)), 2) AS "accumulated_return_pct"
   FROM ("public"."investors" "i"
     LEFT JOIN "public"."investor_project_position" "p" ON (("p"."investor_id" = "i"."id")))
  GROUP BY "i"."id";


ALTER VIEW "public"."investor_financial_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."investor_financial_summary" IS 'Home screen figures per investor. accumulated_return_pct = yield from fully liquidated positions / capital contributed to those same positions; NULL when nothing has been liquidated yet. yield_received is the total received, open projects included.';



CREATE OR REPLACE VIEW "public"."investor_project_distribution" WITH ("security_invoker"='true') AS
 SELECT "investor_id",
    "project_id",
    "current_capital"
   FROM "public"."investor_project_position"
  WHERE ("current_capital" > (0)::numeric);


ALTER VIEW "public"."investor_project_distribution" OWNER TO "postgres";


COMMENT ON VIEW "public"."investor_project_distribution" IS 'Current capital per investor and project, excluding positions at zero. For the home donut chart.';



CREATE OR REPLACE VIEW "public"."investor_totals" WITH ("security_invoker"='true') AS
 SELECT "i"."id" AS "investor_id",
    COALESCE("sum"("cc"."amount_committed"), (0)::numeric) AS "total_committed",
    COALESCE("sum"("cc"."amount_received"), (0)::numeric) AS "total_received"
   FROM ("public"."investors" "i"
     LEFT JOIN "public"."capital_contributions" "cc" ON (("cc"."investor_id" = "i"."id")))
  GROUP BY "i"."id";


ALTER VIEW "public"."investor_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "report_month" "date",
    "physical_progress" "text",
    "financial_progress" "text",
    "capital_used_month" numeric(14,2),
    "photos" "text"[],
    "decisions" "text",
    "risks" "text",
    "next_steps" "text",
    "next_report_date" "date",
    "report_pdf_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."monthly_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "address" "text",
    "city" "text",
    "type" "text",
    "status" "text",
    "lot_value" numeric(14,2),
    "capital_required" numeric(14,2),
    "estimated_sale_value" numeric(14,2),
    "estimated_rent" numeric(14,2),
    "progress" integer DEFAULT 0,
    "description" "text",
    "selling_points" "jsonb",
    "responsible" "text",
    "next_step" "text",
    "deadline" "date",
    "drive_folder_url" "text",
    "main_photos" "text"[],
    "in_fundraising" boolean DEFAULT false NOT NULL,
    "fundraising_goal" numeric(14,2),
    "lat" numeric(9,6),
    "lng" numeric(9,6),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "offered_return" "text",
    CONSTRAINT "projects_city_check" CHECK (("city" = ANY (ARRAY['Punta Gorda'::"text", 'Rotonda'::"text", 'North Port'::"text", 'Otra'::"text"]))),
    CONSTRAINT "projects_company_check" CHECK (("company" = ANY (ARRAY['Investors 180 Group'::"text", 'F1'::"text", 'F3'::"text", 'Otra LLC'::"text"]))),
    CONSTRAINT "projects_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['en evaluación'::"text", 'en reserva'::"text", 'permisos'::"text", 'construcción'::"text", 'vendido'::"text", 'rentado'::"text", 'pausado'::"text"]))),
    CONSTRAINT "projects_type_check" CHECK (("type" = ANY (ARRAY['lote'::"text", 'casa'::"text", 'triplex'::"text", 'multifamily'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."offered_return" IS 'Public marketing return offered by the project (free text). Distinct from capital_contributions.agreed_return, which is the private per-investor agreed return.';



CREATE OR REPLACE VIEW "public"."project_fundraising" AS
 SELECT "p"."id" AS "project_id",
    (COALESCE("sum"("cc"."amount_received"), (0)::numeric))::numeric(14,2) AS "capital_raised"
   FROM ("public"."projects" "p"
     LEFT JOIN "public"."capital_contributions" "cc" ON (("cc"."project_id" = "p"."id")))
  GROUP BY "p"."id";


ALTER VIEW "public"."project_fundraising" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_fundraising" IS 'Project-level capital raised, owner-rights on purpose so the catalogue shows the real total to any authenticated user. Aggregate only: exposes no investor identity or per-investor amount.';



CREATE OR REPLACE VIEW "public"."project_totals" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "project_id",
    COALESCE("sum"("cc"."amount_received"), (0)::numeric) AS "capital_received",
    ("p"."capital_required" - COALESCE("sum"("cc"."amount_received"), (0)::numeric)) AS "capital_pending",
    ( SELECT COALESCE("sum"("b"."actual_spent"), (0)::numeric) AS "coalesce"
           FROM "public"."budget_items" "b"
          WHERE ("b"."project_id" = "p"."id")) AS "executed_budget"
   FROM ("public"."projects" "p"
     LEFT JOIN "public"."capital_contributions" "cc" ON (("cc"."project_id" = "p"."id")))
  GROUP BY "p"."id", "p"."capital_required";


ALTER VIEW "public"."project_totals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signing_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "investor_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "capital_contribution_id" "uuid",
    "external_document_id" "text" NOT NULL,
    "status" "text" DEFAULT 'enviado'::"text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "declined_reason" "text",
    "signed_document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "signing_requests_status_check" CHECK (("status" = ANY (ARRAY['enviado'::"text", 'entregado'::"text", 'completado'::"text", 'rechazado'::"text", 'anulado'::"text", 'expirado'::"text"])))
);


ALTER TABLE "public"."signing_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."signing_requests" IS 'One row per e-signature request. Status is authoritative from the provider webhook; investors have read-only access to their own rows and no write policy at all.';



COMMENT ON COLUMN "public"."signing_requests"."external_document_id" IS 'Envelope id in Documenso. A webhook event is matched to a row by this value; an unmatched event is ignored rather than applied.';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "task" "text",
    "stage" "text",
    "responsible" "text",
    "estimated_date" "date",
    "actual_date" "date",
    "priority" "text",
    "status" "text",
    "next_action" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['alta'::"text", 'media'::"text", 'baja'::"text"]))),
    CONSTRAINT "tasks_stage_check" CHECK (("stage" = ANY (ARRAY['evaluación'::"text", 'oferta'::"text", 'due diligence'::"text", 'survey'::"text", 'diseño'::"text", 'planos'::"text", 'permisos'::"text", 'construcción'::"text", 'inspecciones'::"text", 'renta'::"text", 'venta'::"text", 'refinanciación'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'en proceso'::"text", 'completada'::"text", 'atrasada'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'visitante'::"text" NOT NULL,
    "status" "text" DEFAULT 'registrado'::"text" NOT NULL,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "identity_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "document_id" "text",
    "phone_country_code" "text",
    "city" "text",
    "country" "text",
    "city_place_id" "text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['visitante'::"text", 'inversionista'::"text", 'admin'::"text"]))),
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['invitado'::"text", 'registrado'::"text", 'activo'::"text", 'suspendido'::"text", 'desactivado'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."document_id" IS 'National ID / cédula. Digits only, validated by the onboarding schema.';



COMMENT ON COLUMN "public"."users"."phone_country_code" IS 'Dial code of users.phone, e.g. "+57". Redundant with the E.164 value in users.phone, kept so the UI can restore the country selector without parsing.';



COMMENT ON COLUMN "public"."users"."city" IS 'City name as shown by Google Places autocomplete.';



COMMENT ON COLUMN "public"."users"."country" IS 'Country of the selected city, when Places returns it.';



COMMENT ON COLUMN "public"."users"."city_place_id" IS 'Google Places place_id of users.city. Lets the city be resolved again later without relying on the stored text.';



ALTER TABLE ONLY "public"."budget_items"
    ADD CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capital_contributions"
    ADD CONSTRAINT "capital_contributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investment_interests"
    ADD CONSTRAINT "investment_interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."investors"
    ADD CONSTRAINT "investors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_reports"
    ADD CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reassignment_requests"
    ADD CONSTRAINT "reassignment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_external_document_id_key" UNIQUE ("external_document_id");



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "signing_requests_investor_idx" ON "public"."signing_requests" USING "btree" ("investor_id");



ALTER TABLE ONLY "public"."budget_items"
    ADD CONSTRAINT "budget_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capital_contributions"
    ADD CONSTRAINT "capital_contributions_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."capital_contributions"
    ADD CONSTRAINT "capital_contributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."identity_verifications"
    ADD CONSTRAINT "identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_interests"
    ADD CONSTRAINT "investment_interests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investment_interests"
    ADD CONSTRAINT "investment_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."investors"
    ADD CONSTRAINT "investors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_reports"
    ADD CONSTRAINT "monthly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reassignment_requests"
    ADD CONSTRAINT "reassignment_requests_from_project_id_fkey" FOREIGN KEY ("from_project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reassignment_requests"
    ADD CONSTRAINT "reassignment_requests_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reassignment_requests"
    ADD CONSTRAINT "reassignment_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reassignment_requests"
    ADD CONSTRAINT "reassignment_requests_to_project_id_fkey" FOREIGN KEY ("to_project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_capital_contribution_id_fkey" FOREIGN KEY ("capital_contribution_id") REFERENCES "public"."capital_contributions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."signing_requests"
    ADD CONSTRAINT "signing_requests_signed_document_id_fkey" FOREIGN KEY ("signed_document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_investor_id_fkey" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "budget_admin_write" ON "public"."budget_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."budget_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_select" ON "public"."budget_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "capital_admin_write" ON "public"."capital_contributions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."capital_contributions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "capital_select_own" ON "public"."capital_contributions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_admin_write" ON "public"."documents" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("visibility" = 'público'::"text") OR (("visibility" = 'proyecto'::"text") AND ("project_id" IS NOT NULL) AND "public"."has_project_stake"("project_id")) OR ("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



COMMENT ON POLICY "documents_select" ON "public"."documents" IS 'público: any authenticated user. proyecto: only someone holding a stake in that project. privado: only the investor it belongs to. Admins see everything. The storage policy on the documents bucket defers to this, so tightening here tightens downloads too.';



CREATE POLICY "identity_select_own" ON "public"."identity_verifications" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."identity_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "interests_insert_own" ON "public"."investment_interests" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'nuevo'::"text")));



COMMENT ON POLICY "interests_insert_own" ON "public"."investment_interests" IS 'A user may register an interest only for themselves and only in state nuevo. Advancing it to contactado or cerrado is the admin''s job.';



CREATE POLICY "interests_select_own" ON "public"."investment_interests" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."investment_interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."investors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "investors_admin_write" ON "public"."investors" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "investors_select_own" ON "public"."investors" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."monthly_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_admin_write" ON "public"."projects" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "projects_select_all" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."reassignment_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_admin_write" ON "public"."monthly_reports" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "reports_select" ON "public"."monthly_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "requests_admin_update" ON "public"."reassignment_requests" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "requests_insert_own" ON "public"."reassignment_requests" FOR INSERT TO "authenticated" WITH CHECK ((("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("status" = 'pendiente'::"text")));



COMMENT ON POLICY "requests_insert_own" ON "public"."reassignment_requests" IS 'An investor may create a reassignment request only for themselves and only in state pendiente. Approving or rejecting is an UPDATE, restricted to admins by requests_admin_update.';



CREATE POLICY "requests_select_own" ON "public"."reassignment_requests" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."signing_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "signing_requests_admin_write" ON "public"."signing_requests" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "signing_requests_select_own" ON "public"."signing_requests" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_admin_write" ON "public"."tasks" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "tasks_select" ON "public"."tasks" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_admin_write" ON "public"."transactions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "transactions_select_own" ON "public"."transactions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("investor_id" IN ( SELECT "investors"."id"
   FROM "public"."investors"
  WHERE ("investors"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") OR "public"."is_admin"()));



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



COMMENT ON POLICY "users_update_own" ON "public"."users" IS 'Restricts an update to the caller''s own row. WHICH COLUMNS they may write is enforced separately by column-level GRANTs (see migration 20260806172657): role, status, identity_verified and email are not writable by authenticated.';



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_save_table_changes"("p_table" "text", "p_updates" "jsonb", "p_inserts" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_save_table_changes"("p_table" "text", "p_updates" "jsonb", "p_inserts" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_save_table_changes"("p_table" "text", "p_updates" "jsonb", "p_inserts" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_project_stake"("p_project_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_project_stake"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_project_stake"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON TABLE "public"."budget_items" TO "anon";
GRANT ALL ON TABLE "public"."budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."capital_contributions" TO "anon";
GRANT ALL ON TABLE "public"."capital_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."capital_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."identity_verifications" TO "anon";
GRANT ALL ON TABLE "public"."identity_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."identity_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."investment_interests" TO "anon";
GRANT ALL ON TABLE "public"."investment_interests" TO "authenticated";
GRANT ALL ON TABLE "public"."investment_interests" TO "service_role";



GRANT ALL ON TABLE "public"."reassignment_requests" TO "anon";
GRANT ALL ON TABLE "public"."reassignment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."reassignment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."investor_project_position" TO "anon";
GRANT ALL ON TABLE "public"."investor_project_position" TO "authenticated";
GRANT ALL ON TABLE "public"."investor_project_position" TO "service_role";



GRANT ALL ON TABLE "public"."investors" TO "anon";
GRANT ALL ON TABLE "public"."investors" TO "authenticated";
GRANT ALL ON TABLE "public"."investors" TO "service_role";



GRANT ALL ON TABLE "public"."investor_financial_summary" TO "anon";
GRANT ALL ON TABLE "public"."investor_financial_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."investor_financial_summary" TO "service_role";



GRANT ALL ON TABLE "public"."investor_project_distribution" TO "anon";
GRANT ALL ON TABLE "public"."investor_project_distribution" TO "authenticated";
GRANT ALL ON TABLE "public"."investor_project_distribution" TO "service_role";



GRANT ALL ON TABLE "public"."investor_totals" TO "anon";
GRANT ALL ON TABLE "public"."investor_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."investor_totals" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_reports" TO "anon";
GRANT ALL ON TABLE "public"."monthly_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_reports" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."project_fundraising" TO "service_role";
GRANT SELECT ON TABLE "public"."project_fundraising" TO "authenticated";



GRANT ALL ON TABLE "public"."project_totals" TO "anon";
GRANT ALL ON TABLE "public"."project_totals" TO "authenticated";
GRANT ALL ON TABLE "public"."project_totals" TO "service_role";



GRANT ALL ON TABLE "public"."signing_requests" TO "anon";
GRANT ALL ON TABLE "public"."signing_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."signing_requests" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("avatar_url") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("onboarding_completed") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("document_id") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("phone_country_code") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("city") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("country") ON TABLE "public"."users" TO "authenticated";



GRANT UPDATE("city_place_id") ON TABLE "public"."users" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







