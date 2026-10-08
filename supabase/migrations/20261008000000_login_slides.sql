-- Fotos del carrusel de la pantalla de login, editables desde el panel.
--
-- Hasta ahora eran cuatro archivos en /public: cambiarlas exigía tocar el
-- repositorio y volver a desplegar. Pasan a ser filas, con su imagen en el
-- bucket `project-photos` (carpeta `login/`), que ya es público y ya tiene
-- políticas de escritura solo para admin.
--
-- SEGURIDAD — la diferencia con el resto de tablas: esta se lee SIN SESIÓN.
-- La pantalla de login es lo primero que ve alguien que todavía no ha entrado,
-- así que la política de lectura incluye al rol `anon`. No hay nada privado
-- aquí: son las imágenes decorativas de una página pública. La escritura sigue
-- siendo exclusiva de public.is_admin(), igual que projects.
--
-- Si la tabla está vacía (o no se puede leer), la aplicación muestra las
-- cuatro imágenes estáticas de siempre: el login no depende de esta tabla
-- para funcionar.

create table if not exists public.login_slides (
  id uuid primary key default gen_random_uuid(),
  -- URL pública del objeto en Storage.
  image_url text not null,
  -- Texto que acompaña a la imagen. Opcional: una foto puede ir sin frase.
  caption text,
  -- Orden de aparición. Menor primero; los empates se rompen por created_at.
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  constraint login_slides_image_url_not_blank check (btrim(image_url) <> ''),
  constraint login_slides_caption_length check (
    caption is null or char_length(caption) <= 120
  ),
  constraint login_slides_position_range check (position >= 0 and position <= 100)
);

comment on table public.login_slides is
  'Imágenes del carrusel de la pantalla de login, con su frase. Lectura pública (incluye anon: la pantalla es previa al acceso); escritura solo admin. Sin filas, la app usa las imágenes estáticas de /public/carousel.';

create index if not exists login_slides_position_idx
  on public.login_slides (position, created_at);

alter table public.login_slides enable row level security;

-- Lectura abierta: la pantalla de login se renderiza sin sesión.
create policy "login_slides_select_all" on public.login_slides
  for select
  to anon, authenticated
  using ( true );

-- Escritura solo admin, la misma regla que projects_admin_write.
create policy "login_slides_admin_write" on public.login_slides
  for all
  to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- Las tablas nuevas de `public` no quedan expuestas por la Data API sin GRANT
-- explícito (ver auto_expose_new_tables en supabase/config.toml).
grant select on public.login_slides to anon, authenticated;
grant insert, update, delete on public.login_slides to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
-- drop table if exists public.login_slides;
