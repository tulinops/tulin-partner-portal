import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN" || !session.user.tenantId) {
    redirect("/login");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  return session;
}

// Any logged-in user, Admin or Super Admin — for account-level actions
// (like changing your own password) that aren't tied to a specific role.
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
