import type { Database } from "./database";

// Enum values stay in Spanish: they are stored that way in the database
// (text + check constraints) and shown as-is in the UI.
export const ROLES = ["visitante", "inversionista", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = [
  "invitado",
  "registrado",
  "activo",
  "suspendido",
  "desactivado",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

type UsersRow = Database["public"]["Tables"]["users"]["Row"];

export type UserProfile = Omit<UsersRow, "role" | "status"> & {
  role: Role;
  status: UserStatus;
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isUserStatus(value: string): value is UserStatus {
  return (USER_STATUSES as readonly string[]).includes(value);
}
