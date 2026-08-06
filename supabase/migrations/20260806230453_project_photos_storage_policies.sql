-- Write access to the `project-photos` bucket.
--
-- The bucket is PUBLIC, so reading a photo through the public URL never touches
-- RLS — that half already worked. Writing did not: the bucket had no policy at
-- all, so every upload was refused, including an admin's own
-- ("new row violates row-level security policy"). Nothing could put a photo on
-- a project except the service role.
--
-- Who may write: admins only, the same rule projects_admin_write applies to the
-- rows these files belong to. An investor or a visitor has no business adding
-- pictures to a project.
--
-- SELECT is granted too even though the bucket is public: the storage API needs
-- it to list and to resolve an object before removing it, and a public bucket's
-- contents are readable by anyone with the URL regardless, so it concedes
-- nothing that was not already open.

create policy "project_photos_admin_insert"
on storage.objects for insert to authenticated
with check ( bucket_id = 'project-photos' and public.is_admin() );

create policy "project_photos_admin_update"
on storage.objects for update to authenticated
using ( bucket_id = 'project-photos' and public.is_admin() )
with check ( bucket_id = 'project-photos' and public.is_admin() );

create policy "project_photos_admin_delete"
on storage.objects for delete to authenticated
using ( bucket_id = 'project-photos' and public.is_admin() );

create policy "project_photos_read"
on storage.objects for select to authenticated
using ( bucket_id = 'project-photos' );

comment on policy "project_photos_admin_insert" on storage.objects is
  'Only an admin may add project photos, matching projects_admin_write on the rows they belong to.';
