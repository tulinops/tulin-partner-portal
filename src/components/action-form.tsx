"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actionResult";

// Drop-in replacement for <form action={serverAction}> that adds a
// success/failure toast. Works with any existing "use server" action
// function passed in as a prop (Server Actions can be passed to Client
// Components as props) — no change needed to the actions themselves beyond
// wrapping their body in asActionResult (src/lib/actionResult.ts), which is
// what makes a thrown validation Error ("Not enough stock...", "Document
// not found", etc.) survive to the failure toast in production too.
export function ActionForm({
  action,
  successMessage,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  successMessage: string;
  className?: string;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    // Second arg captures which submit button was clicked (name/value) —
    // needed for forms with several submit buttons, e.g. the site visit
    // result buttons, same as native form submission would include.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const formData = new FormData(form, submitter ?? undefined);

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success(successMessage);
        }
      } catch (err) {
        // Only reached for an error asActionResult chose to rethrow (an
        // unexpected, non-validation failure) — its message is redacted in
        // production, so this toast is necessarily generic there.
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={pending}>
      {children}
    </form>
  );
}
