-- Read access to the objects of the PRIVATE `documents` bucket.
--
-- Why this exists: the bucket had no storage policy at all, so RLS denied every
-- object to every authenticated user. Supabase masks that denial as
-- "Object not found", which made it look like a missing file rather than a
-- missing permission. The practical effect was that /documentos could hand back
-- external (Drive) links but could NEVER sign a file actually stored in
-- Supabase — the download route always failed at the signing step.
--
-- The entitlement is NOT restated here. The policy asks whether a row in
-- public.documents points at this object, and that sub-select runs as the
-- caller, so public.documents' own RLS decides which rows they can see. One
-- definition of "may this person have this document", in one place: change
-- documents_select and this follows automatically.
--
-- SELECT only. Uploading stays with the admin tooling / service role; there is
-- no upload UI yet, and granting write here would be a separate decision.

create policy "documents_objects_select_entitled"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and exists (
    select 1
    from public.documents d
    where
      -- file_url stored as a bare object path (the normal case)
      d.file_url = storage.objects.name
      or d.file_url = '/' || storage.objects.name
      or d.file_url = 'documents/' || storage.objects.name
      -- ...or as a full Storage URL, signed or not
      or d.file_url like '%/storage/v1/object/%documents/' || storage.objects.name
      or d.file_url like '%/storage/v1/object/%documents/' || storage.objects.name || '?%'
  )
);

comment on policy "documents_objects_select_entitled" on storage.objects is
  'Lets a user read an object of the documents bucket only when a public.documents row they are allowed to see points at it. The entitlement comes from that table''s RLS, not from a rule duplicated here.';
