import { forTenant } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

/**
 * The one call every Admin-facing server action/page should use to get both
 * the current tenant id and a Prisma client that can only ever see that
 * tenant's rows. Never import basePrisma directly outside src/lib or the
 * (super-admin) route group.
 */
export async function getTenantDb() {
  const session = await requireAdmin();
  const tenantId = session.user.tenantId!;
  return { db: forTenant(tenantId), tenantId };
}
