"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

// A plain <Button type="submit"> inside a <form action={...}> triggers the
// server action immediately on click — this intercepts that click with a
// native confirm() so an irreversible action isn't one accidental click away.
export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { confirmMessage: string }) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}
