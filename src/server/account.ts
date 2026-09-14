"use server";

import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/permissions";
import { basePrisma } from "@/lib/db";

// User isn't a tenant-scoped model (see TENANT_SCOPED_MODELS in
// src/lib/db.ts) — that's fine here since we always scope by the
// authenticated user's own id, never by tenant, and this needs to work for
// both ADMIN and SUPER_ADMIN alike.
export async function changePassword(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  const session = await requireAuth();

  if (input.newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }
  if (input.newPassword !== input.confirmPassword) {
    throw new Error("New password and confirmation do not match");
  }

  const user = await basePrisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("User not found");

  const currentMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentMatches) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await basePrisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });
}
