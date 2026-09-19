"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useActionFormState } from "@/components/action-form";

// A plain <Button type="submit"> inside a <form action={...}> triggers the
// server action immediately on click — this intercepts that click with a
// native confirm() so an irreversible action isn't one accidental click away.
// `confirmWhenFieldEquals` + `skipConfirm` (plain, serializable values, not a
// predicate function — this is rendered from Server Components, which can't
// pass closures to a Client Component prop) let the caller only ask when the
// form's current state actually warrants it, e.g. a status dropdown
// currently set to a particular value. Omit both to always confirm.
export function ConfirmSubmitButton({
  confirmMessage,
  confirmWhenFieldEquals,
  skipConfirm,
  disabled,
  onClick,
  ...props
}: ComponentProps<typeof Button> & {
  confirmMessage: string;
  confirmWhenFieldEquals?: { name: string; value: string };
  skipConfirm?: boolean;
}) {
  const { pending, dirty } = useActionFormState();
  return (
    <Button
      {...props}
      disabled={pending || !dirty || disabled}
      onClick={(event) => {
        const form = event.currentTarget.closest("form");
        const fieldMatches =
          !confirmWhenFieldEquals ||
          (!!form && new FormData(form).get(confirmWhenFieldEquals.name) === confirmWhenFieldEquals.value);
        const needsConfirm = fieldMatches && !skipConfirm;
        if (needsConfirm && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
