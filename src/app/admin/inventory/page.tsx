import { listInventoryItems, createInventoryItem, recordPurchase } from "@/server/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  await createInventoryItem({
    name: String(formData.get("name")),
    unit: String(formData.get("unit") || "pcs"),
    supplier: String(formData.get("supplier") || "") || undefined,
  });
}

async function recordPurchaseAction(formData: FormData) {
  "use server";
  await recordPurchase({
    inventoryItemId: String(formData.get("inventoryItemId")),
    quantity: Number(formData.get("quantity")),
    unitCost: Number(formData.get("unitCost")),
    supplier: String(formData.get("purchaseSupplier") || "") || undefined,
  });
}

export default async function InventoryPage() {
  const items = await listInventoryItems();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">Inventory</h1>

      <Card>
        <CardHeader>
          <CardTitle>New item type</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createItemAction} className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="540W Mono Panel" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" defaultValue="pcs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" name="supplier" />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">Add item</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Record a purchase (stock in)</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={recordPurchaseAction} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="inventoryItemId">Item</Label>
                <Select name="inventoryItemId" required>
                  <SelectTrigger id="inventoryItemId">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit cost (₹)</Label>
                <Input id="unitCost" name="unitCost" type="number" step="0.01" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="purchaseSupplier">Supplier (optional)</Label>
                <Input id="purchaseSupplier" name="purchaseSupplier" />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit">Record purchase</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Running stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>{item.supplier ?? "—"}</TableCell>
              <TableCell>
                {item.runningStock.toString()} {item.unit}
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No inventory items yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
