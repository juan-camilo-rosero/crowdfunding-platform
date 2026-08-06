"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { es } from "@/i18n";
import { Button } from "@/components/ui/button";

export type DownloadButtonProps = {
  documentId: string;
  /** Used only for the accessible label, so each button names its own file. */
  documentName: string;
};

/**
 * Download control for one row.
 *
 * It only ever sends the document ID. The server resolves the actual location —
 * a signed URL for the private bucket, or the external link — after checking
 * that this caller may read that row (see the route handler). Nothing about the
 * file's whereabouts is known to, or trusted from, the client.
 *
 * A failure is shown next to the row rather than thrown away or turned into a
 * page-level error: the other rows keep working.
 */
export function DownloadButton({
  documentId,
  documentName,
}: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/download`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(
          response.status === 404 && payload.error === "no-file"
            ? es.documents.noFile
            : response.status === 404 || response.status === 401
              ? es.documents.downloadDenied
              : es.documents.downloadError
        );
        return;
      }

      const { url } = (await response.json()) as { url: string };
      // noopener/noreferrer: the target is an external host or a signed link.
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError(es.documents.downloadError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="brand"
        size="sm"
        onClick={handleDownload}
        loading={isLoading}
        loadingText={es.documents.downloading}
        aria-label={es.documents.downloadLabel.replace("{name}", documentName)}
      >
        <DownloadIcon data-icon="inline-start" aria-hidden="true" />
        {es.documents.download}
      </Button>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
