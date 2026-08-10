import type { IdentityProvider, VerificationOutcome, VerificationStart } from "../types";

/**
 * Identity verification without a vendor.
 *
 * The outcome is decided HERE, on the server, from an environment variable —
 * never by the caller and never by anything the browser sends. That is the
 * whole point: the mock has to be as un-spoofable as Truora, or testing the
 * flow would teach us the wrong lesson about how it is secured.
 *
 *   IDENTITY_MOCK_OUTCOME  "aprobado" (default) | "rechazado" | "expirado"
 *
 * The unhappy paths exist so the retry UI can be exercised. Flipping the
 * variable is a deployment act, not something a user can reach.
 */
const MOCK_DECLINE_REASON = "Simulación de rechazo (IDENTITY_MOCK_OUTCOME).";

function configuredOutcome(): VerificationOutcome {
  switch (process.env.IDENTITY_MOCK_OUTCOME?.trim().toLowerCase()) {
    case "rechazado":
      return { status: "rechazado", declineReason: MOCK_DECLINE_REASON };
    case "expirado":
      return { status: "expirado", declineReason: MOCK_DECLINE_REASON };
    default:
      return { status: "aprobado" };
  }
}

export function createMockIdentityProvider(): IdentityProvider {
  return {
    name: "mock",
    async startVerification(userId: string): Promise<VerificationStart> {
      return {
        status: "resolved",
        // Recognisable in the database as not coming from Truora.
        processId: `mock-${userId}-${Date.now()}`,
        outcome: configuredOutcome(),
      };
    },
  };
}
