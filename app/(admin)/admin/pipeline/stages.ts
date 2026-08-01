/**
 * The funnel is driven by `investors.pipeline_stage`, NOT by `investors.status`.
 *
 * They are two different enums on the same table and mixing them up shows the
 * wrong data:
 *   pipeline_stage → contacto · calificado · en reunión · en revisión ·
 *                    firmado · desembolsado   (the capture funnel, views.md)
 *   status         → prospecto · interesado · en revisión · comprometido ·
 *                    recibido · pausado       (the investor's lifecycle)
 */
export const PIPELINE_STAGE_KEY = "pipeline_stage";

/** Sentinel for "no stage filter". */
export const ALL_STAGES = "todas";

/** Columns the funnel shows, in order (views.md). */
export const PIPELINE_COLUMN_KEYS = [
  "full_name",
  PIPELINE_STAGE_KEY,
  "phone",
  "potential_amount",
  "notes",
] as const;
