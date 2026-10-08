/**
 * When an account may be deleted, and what deleting it actually destroys.
 *
 * WHAT SURVIVES, and why deleting is not as dangerous as it sounds here: the
 * financial record does not hang off the account. `investors.user_id` is
 * ON DELETE SET NULL, so the investor's file stays, merely unlinked — and with
 * it every capital_contribution and transaction, which point at the investor
 * record and not at the user. An admin can link that file to a new account
 * later (the Camino A of user-management.md) and the history is intact.
 *
 * WHAT GOES WITH THE ACCOUNT, by cascade: the login itself, the identity
 * verification, the investment interests (leads) they submitted, their
 * notifications and their device tokens.
 *
 * The two refusals come straight from user-management.md: the last admin can
 * never be removed, and nobody deletes the account they are signed in with.
 */

export type DeletionTarget = {
  id: string;
  isAdmin: boolean;
  /** Has a linked row in `investors`. */
  isInvestor: boolean;
};

export type DeletionRefusal = "self" | "last-admin";

export function whyNotDeletable(
  target: DeletionTarget,
  context: { callerId: string; adminCount: number }
): DeletionRefusal | null {
  // Checked first on purpose: if you are the last admin AND the target, the
  // useful thing to say is "that is your own account".
  if (target.id === context.callerId) return "self";
  if (target.isAdmin && context.adminCount <= 1) return "last-admin";
  return null;
}

export type DeletionImpact = {
  /** The investor file (and its money) stays, unlinked from any account. */
  keepsInvestorRecord: boolean;
  /** They can no longer sign in. Always true — it is what deleting means. */
  losesAccess: boolean;
};

export function deletionImpact(target: DeletionTarget): DeletionImpact {
  return { keepsInvestorRecord: target.isInvestor, losesAccess: true };
}
