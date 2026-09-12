# Tulin Partner Portal

Multi-tenant ops portal for Tulin-affiliated businesses (proprietors/partners). Two roles: **Super Admin** (Tulin — onboards tenants, sees metadata only) and **Admin** (a tenant, e.g. a solar installation business — scoped to their own leads, inventory, connections/installations, and finance).

See `/Users/naveen/.claude/plans/we-have-given-the-velvety-harp.md` for the full design (data model, multi-tenant isolation strategy, auth design, phased scope).

## Local setup

```bash
npm install
npm run db:up        # starts Postgres in Docker on host port 5433
npm run db:migrate    # applies the committed migration
npm run db:seed       # creates the Super Admin + a demo tenant/admin — prints credentials to the console
npm run dev
```

Then open http://localhost:3000/login. Use the credentials printed by `db:seed` (a fresh random password is generated each run — read it from the terminal output, it is not stored anywhere).

If you already run Postgres natively on port 5432, this won't conflict — the Docker container is mapped to `5433` (see `docker-compose.yml` / `.env.example`).

## Verification scripts

```bash
npm run verify:isolation   # confirms tenant data never leaks across tenants
npm run verify:flows       # exercises lead -> connection -> inventory -> payment -> profit end-to-end
```

Both expect a migrated dev database (`db:up` + `db:migrate` first).

## Other scripts

- `npm run build` / `npm run lint` — production build / lint check
- `npm run db:studio` — Prisma Studio, a GUI for browsing the local database

## Known gaps (Phase 1)

No team-member logins (installation staff are plain data, not accounts), no customer-facing view, no email delivery for temp passwords (shown once in the UI — relay out-of-band), no automated test suite beyond the two verification scripts above.
