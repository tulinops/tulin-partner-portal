"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateStaffMember } from "@/server/staff";

export type EditableStaff = {
  id: string;
  name: string;
  phone: string | null;
  designation: string | null;
  address: string | null;
  isActive: boolean;
};

export function EditStaffDialog({ staff }: { staff: EditableStaff }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(staff.name);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [designation, setDesignation] = useState(staff.designation ?? "");
  const [address, setAddress] = useState(staff.address ?? "");
  const [isActive, setIsActive] = useState(staff.isActive);
  const [pending, setPending] = useState(false);

  // Save stays disabled until something actually differs from the saved
  // record — no point re-submitting unchanged data.
  const isDirty =
    name !== staff.name ||
    phone !== (staff.phone ?? "") ||
    designation !== (staff.designation ?? "") ||
    address !== (staff.address ?? "") ||
    isActive !== staff.isActive;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await updateStaffMember({
        id: staff.id,
        name,
        phone: phone.trim() || undefined,
        designation: designation.trim() || undefined,
        address: address.trim() || undefined,
        isActive,
      });
      toast.success("Worker updated");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Re-sync fields with the latest saved values each time the
          // dialog opens, in case another edit happened since last time.
          setName(staff.name);
          setPhone(staff.phone ?? "");
          setDesignation(staff.designation ?? "");
          setAddress(staff.address ?? "");
          setIsActive(staff.isActive);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title={`Edit ${staff.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>Edit worker</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${staff.id}`}>Name</Label>
            <Input id={`name-${staff.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`phone-${staff.id}`}>Phone</Label>
            <Input id={`phone-${staff.id}`} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`designation-${staff.id}`}>Designation</Label>
            <Input
              id={`designation-${staff.id}`}
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`address-${staff.id}`}>Address</Label>
            <Input id={`address-${staff.id}`} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`status-${staff.id}`}>Status</Label>
            <Select value={isActive ? "true" : "false"} onValueChange={(v) => setIsActive(v === "true")}>
              <SelectTrigger id={`status-${staff.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active (presently working)</SelectItem>
                <SelectItem value="false">Inactive (not working)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={!isDirty || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
