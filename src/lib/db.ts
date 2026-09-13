import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  basePrisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const basePrisma =
  globalForPrisma.basePrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.basePrisma = basePrisma;
}

// Every tenant-owned model. Any model not in this list (Tenant, User) is
// deliberately NOT auto-scoped and must be queried explicitly.
const TENANT_SCOPED_MODELS = new Set([
  "Lead",
  "LeadNote",
  "Estimate",
  "InventoryItem",
  "InventoryTransaction",
  "Connection",
  "CustomerPayment",
  "StaffMember",
  "SitePhoto",
  "RequiredDocumentType",
  "ConnectionDocument",
  "LoanApplication",
  "WarrantyRecord",
]);

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const WHERE_WRITE_OPS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Returns a Prisma client bound to a single tenant. Every operation on a
 * tenant-scoped model gets `tenantId` injected into its `where` clause (reads
 * and writes) or `data` (creates) — this is the ONLY sanctioned way to query
 * tenant data, so a query that forgets to filter by tenant still can't leak
 * across tenants. See src/lib/tenantDb.ts for the session-bound wrapper used
 * by Admin-facing code.
 */
export function forTenant(tenantId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          // The runtime args shape genuinely varies per operation (this is a
          // generic cross-model interceptor), which is exactly what the
          // static per-operation Args types can't express — hence the cast.
          const scopedArgs = args as Record<string, unknown>;

          if (READ_OPS.has(operation) || WHERE_WRITE_OPS.has(operation)) {
            scopedArgs.where = { ...(scopedArgs.where as object ?? {}), tenantId };
          } else if (operation === "create") {
            scopedArgs.data = { ...(scopedArgs.data as object), tenantId };
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            scopedArgs.data = Array.isArray(scopedArgs.data)
              ? scopedArgs.data.map((d: Record<string, unknown>) => ({ ...d, tenantId }))
              : { ...(scopedArgs.data as object), tenantId };
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof forTenant>;

/**
 * Explicit, intentionally awkward-to-reach escape hatch for the small set of
 * Super Admin code paths that legitimately need cross-tenant queries (e.g.
 * listing tenants). Never use this for tenant business data. An ESLint rule
 * (see .eslintrc) blocks importing it outside src/lib and the
 * (super-admin) route group.
 */
export function forSuperAdminUnscoped() {
  return basePrisma;
}
