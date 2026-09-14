"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// The <form action={warrantyCreateAction}> itself is authored in the parent
// Server Component and passed in as children — this wrapper only owns the
// open/close state, so the server action never needs a client boundary.
export function AddWarrantyDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">+ Add warranty</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>Add warranty record</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
