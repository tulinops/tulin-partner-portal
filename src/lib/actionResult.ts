export type ActionResult = { error: string } | void;

// React redacts a thrown Server Action error's message in production builds
// (only a `digest` survives the client/server boundary) — so validation
// errors like "Cannot delete — 3 connections..." never reach the user there,
// even though they show up fine in dev. Wrapping a Server Action body in
// this converts a hand-thrown `Error` into a returned { error } value
// instead, which isn't subject to that redaction. Anything that isn't a
// plain `Error` we threw ourselves (e.g. a Prisma error) rethrows unchanged,
// so genuinely unexpected failures stay redacted and logged server-side.
export async function asActionResult(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) {
      return { error: err.message };
    }
    throw err;
  }
}
