import { X } from "lucide-react";
import { listInventoryItems, createInventoryItem, recordPurchase, deleteInventoryItem } from "@/server/inventory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { asActionResult } from "@/lib/actionResult";
import { EditItemDialog } from "./edit-item-dialog";
import { RecordPurchaseForm } from "./record-purchase-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function createItemAction(formData: FormData) {
  "use server";
  return asActionResult(() =>
    createInventoryItem({
      name: String(formData.get("name")),
      brand: String(formData.get("brand") || "") || undefined,
      unit: String(formData.get("unit") || "pcs"),
      supplier: String(formData.get("supplier") || "") || undefined,
    }),
  );
}

async function recordPurchaseAction(formData: FormData) {
  "use server";
  return asActionResult(() =>
    recordPurchase({
      inventoryItemId: String(formData.get("inventoryItemId")),
      quantity: Number(formData.get("quantity")),
      unitCost: Number(formData.get("unitCost")),
      supplier: String(formData.get("purchaseSupplier") || "") || undefined,
      brand: String(formData.get("purchaseBrand") || "") || undefined,
    }),
  );
}

async function deleteItemAction(formData: FormData) {
  "use server";
  return asActionResult(() => deleteInventoryItem(String(formData.get("id"))));
}

function money(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function InventoryPage() {
  const items = await listInventoryItems();
  // Plain, Decimal-free shape for the client-side item picker — passing the
  // raw Prisma records (runningStock/transactions carry Decimal objects)
  // across the server/client boundary isn't allowed.
  const purchasableItems = items.map((item) => ({ id: item.id, name: item.name, brand: item.brand }));

  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ label: "Inventory" }]} title="Inventory" />

      <Card>
        <CardHeader>
          <CardTitle>New item type</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createItemAction}
            successMessage="Item added"
            disableUntilChanged
            className="grid gap-4 sm:grid-cols-5"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="540W Mono Panel" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" defaultValue="pcs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" name="supplier" />
            </div>
            <div className="sm:col-span-5">
              <SubmitButton>Add item</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Record a purchase (stock in)</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordPurchaseForm items={purchasableItems} action={recordPurchaseAction} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Running stock</TableHead>
                <TableHead>Total purchased</TableHead>
                <TableHead>Total allocated</TableHead>
                <TableHead>Avg. purchase cost</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const purchases = item.transactions.filter((t) => t.type === "PURCHASE");
                const allocations = item.transactions.filter((t) => t.type === "ALLOCATION");
                const totalPurchasedQty = purchases.reduce((sum, t) => sum + Number(t.quantity), 0);
                const totalPurchasedCost = purchases.reduce(
                  (sum, t) => sum + Number(t.quantity) * Number(t.unitCost ?? 0),
                  0,
                );
                const totalAllocatedQty = allocations.reduce((sum, t) => sum + Number(t.quantity), 0);
                const avgUnitCost = totalPurchasedQty > 0 ? totalPurchasedCost / totalPurchasedQty : 0;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.brand ?? "—"}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.supplier ?? "—"}</TableCell>
                    <TableCell>
                      {item.runningStock.toString()} {item.unit}
                    </TableCell>
                    <TableCell>
                      {totalPurchasedQty} {item.unit}
                    </TableCell>
                    <TableCell>
                      {totalAllocatedQty} {item.unit}
                    </TableCell>
                    <TableCell>{totalPurchasedQty > 0 ? money(avgUnitCost) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <EditItemDialog
                          item={{
                            id: item.id,
                            name: item.name,
                            brand: item.brand,
                            unit: item.unit,
                            supplier: item.supplier,
                          }}
                        />
                        <ActionForm action={deleteItemAction} successMessage="Item deleted">
                          <input type="hidden" name="id" value={item.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title={`Delete ${item.name}`}
                            confirmMessage={`Delete "${item.name}"? This can't be undone. Items with any purchase/allocation history can't be deleted.`}
                          >
                            <X />
                          </ConfirmSubmitButton>
                        </ActionForm>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No inventory items yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
