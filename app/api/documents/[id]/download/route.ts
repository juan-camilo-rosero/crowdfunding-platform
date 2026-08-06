import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DOCUMENTS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  resolveDownloadTarget,
} from "@/lib/documents/download";

/**
 * Resolves a download link for ONE document, by id.
 *
 * The entitlement check is the row read itself. The client sends an id and
 * nothing else — never a file path — and the row is fetched with the SERVER
 * Supabase client under the caller's own session, so the RLS policy on
 * `documents` decides. If the caller may not see that document the query
 * returns nothing and the answer is 404; no signed URL is ever minted for a row
 * the caller could not read.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately not used anywhere here. It would
 * bypass RLS, which is the only thing standing between one investor and
 * another's private documents.
 *
 * 404 rather than 403 for a forbidden document: telling somebody that a
 * document exists but is not theirs is itself a disclosure.
 */
export async function GET(
  request: NextRequest,
  // Next.js 16: params is async.
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // THE entitlement check. Runs as the caller, so RLS filters it.
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, name, file_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "lookup-failed" }, { status: 502 });
  }

  // Unknown id and forbidden id give the SAME answer, so the endpoint cannot be
  // used to probe which documents exist.
  if (!document) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const target = resolveDownloadTarget(document.file_url);

  if (target.kind === "missing") {
    return NextResponse.json({ error: "no-file" }, { status: 404 });
  }

  // Drive or any other external host: nothing to sign.
  if (target.kind === "external") {
    return NextResponse.json({ url: target.url, name: document.name });
  }

  // Private bucket: a short-lived signed URL is the only way in.
  const { data: signed, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(target.path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "sign-failed" }, { status: 502 });
  }

  return NextResponse.json({ url: signed.signedUrl, name: document.name });
}
