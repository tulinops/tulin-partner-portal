"use client";

import { createContext, useContext, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actionResult";
import { Button } from "@/components/ui/button";

type ActionFormState = { pending: boolean; dirty: boolean; markDirty: () => void };

const ActionFormContext = createContext<ActionFormState>({
  pending: false,
  dirty: true,
  markDirty: () => {},
});

// Exposes ActionForm's pending/dirty state to descendants. Also falls back to
// react-dom's useFormStatus so the same hook works for a plain
// <form action={...}> outside any ActionForm (e.g. Login, Change password) —
// ActionForm's own form is submitted via onSubmit, not a real form action, so
// useFormStatus alone can't see its pending state, hence reading both.
export function useActionFormState(): ActionFormState {
  const ctx = useContext(ActionFormContext);
  const formStatus = useFormStatus();
  return { pending: ctx.pending || formStatus.pending, dirty: ctx.dirty, markDirty: ctx.markDirty };
}

// Drop-in replacement for a plain <button type="submit">: disables itself
// while the enclosing form is submitting, and (if the enclosing ActionForm
// opted into disableUntilChanged) until something's actually been changed.
export function SubmitButton({ disabled, ...props }: ComponentProps<typeof Button>) {
  const { pending, dirty } = useActionFormState();
  return <Button type="submit" disabled={pending || !dirty || disabled} {...props} />;
}

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
  disableUntilChanged,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  successMessage: string;
  className?: string;
  children: ReactNode;
  // Keeps the submit button disabled until a field changes (or a descendant
  // calls markDirty() for a state change that isn't a native form event —
  // e.g. a custom button-group bound to a hidden input). Off by default so
  // existing forms are unaffected; opt in only for forms where saving with
  // nothing changed is never a deliberate action.
  disableUntilChanged?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(!disableUntilChanged);

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
          if (disableUntilChanged) setDirty(false);
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
    <form
      onSubmit={handleSubmit}
      onChange={disableUntilChanged ? () => setDirty(true) : undefined}
      className={className}
      aria-busy={pending}
    >
      <ActionFormContext.Provider value={{ pending, dirty, markDirty: () => setDirty(true) }}>
        {children}
      </ActionFormContext.Provider>
    </form>
  );
}
