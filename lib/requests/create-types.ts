/**
 * Types for CREATING a reassignment request.
 *
 * The reading side lives in lib/requests/types.ts; this file only covers the
 * mutation. Note what the payload does NOT carry: `investor_id` and `status`.
 * The first is derived from auth.uid() on the server and the second is forced
 * to 'pendiente', so neither is something a client can choose.
 */

/** What the form sends. */
export type CreateReassignmentRequestInput = {
  fromProjectId: string;
  toProjectId: string;
  amount: number;
};

/** A project the investor can move capital OUT of. */
export type ReassignmentSource = {
  projectId: string;
  name: string;
  /**
   * Capital that can actually be committed right now: current capital in the
   * project MINUS what pending requests already claim from it.
   */
  availableAmount: number;
};

/** A project the investor can move capital INTO. */
export type ReassignmentDestination = {
  projectId: string;
  name: string;
};

/** Result of the Server Action, in the shape the UI renders. */
export type CreateRequestResult =
  | { ok: true }
  | { ok: false; error: string };
