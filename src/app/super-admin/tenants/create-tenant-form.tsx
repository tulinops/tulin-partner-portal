"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormState = { tempPassword?: string; adminEmail?: string; error?: string } | null;

export function CreateTenantForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" name="name" placeholder="Ravi Solar Solutions" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" placeholder="ravi-solar" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessType">Business type</Label>
          <Select name="businessType" defaultValue="SOLAR">
            <SelectTrigger id="businessType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SOLAR">Solar</SelectItem>
              <SelectItem value="GENERIC">Generic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="adminName">Admin (proprietor) name</Label>
          <Input id="adminName" name="adminName" required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="adminEmail">Admin email</Label>
          <Input id="adminEmail" name="adminEmail" type="email" required />
        </div>
        <div className="sm:col-span-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create tenant"}
          </Button>
        </div>
      </form>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.tempPassword && (
        <p className="rounded-md bg-muted p-3 text-sm">
          Tenant created. Share these credentials with {state.adminEmail} out-of-band (e.g.
          WhatsApp): temp password <span className="font-mono font-semibold">{state.tempPassword}</span>.
          They must change it on first login. This password is shown only once.
        </p>
      )}
    </div>
  );
}
