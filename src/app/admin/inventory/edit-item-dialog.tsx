"use client";

import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInventoryItem } from "@/server/inventory";

export type EditableInventoryItem = {
  id: string;
  name: string;
  brand: string | null;
  unit: string;
  supplier: string | null;
};

export function EditItemDialog({ item }: { item: EditableInventoryItem }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? "");
  const [unit, setUnit] = useState(item.unit);
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [pending, setPending] = useState(false);

  const isDirty =
    name !== item.name ||
    brand !== (item.brand ?? "") ||
    unit !== item.unit ||
    supplier !== (item.supplier ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await updateInventoryItem({
        id: item.id,
        name,
        brand: brand.trim() || undefined,
        unit,
        supplier: supplier.trim() || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Inventory item updated");
        setOpen(false);
      }
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
          setName(item.name);
          setBrand(item.brand ?? "");
          setUnit(item.unit);
          setSupplier(item.supplier ?? "");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" title={`Edit ${item.name}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Edit inventory item</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${item.id}`}>Name</Label>
            <Input id={`name-${item.id}`} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`brand-${item.id}`}>Brand</Label>
            <Input id={`brand-${item.id}`} value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`unit-${item.id}`}>Unit</Label>
            <Input id={`unit-${item.id}`} value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`supplier-${item.id}`}>Supplier</Label>
            <Input id={`supplier-${item.id}`} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={!isDirty || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
