"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

// A plain <Button type="submit"> inside a <form action={...}> triggers the
// server action immediately on click — this intercepts that click with a
// native confirm() so an irreversible action isn't one accidental click away.
// `confirmIf` lets the caller only ask when the form's current state actually
// warrants it (e.g. a status dropdown currently set to a particular value);
// omit it to always confirm.
export function ConfirmSubmitButton({
  confirmMessage,
  confirmIf,
  onClick,
  ...props
}: ComponentProps<typeof Button> & {
  confirmMessage: string;
  confirmIf?: (formData: FormData) => boolean;
}) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        const form = event.currentTarget.closest("form");
        const needsConfirm = confirmIf ? !!form && confirmIf(new FormData(form)) : true;
        if (needsConfirm && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
