"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

// Drop-in replacement for <form action={serverAction}> that adds a
// success/failure toast. Works with any existing "use server" action
// function passed in as a prop (Server Actions can be passed to Client
// Components as props) — no change needed to the actions themselves, and
// their thrown Error messages ("Not enough stock...", "Document not
// found", etc.) surface directly in the failure toast.
export function ActionForm({
  action,
  successMessage,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
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
        await action(formData);
        toast.success(successMessage);
      } catch (err) {
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
