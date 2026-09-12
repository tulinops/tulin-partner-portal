import { notFound } from "next/navigation";
import { getEstimate, type EstimateLineItem } from "@/server/leads";
import { amountInWords } from "@/lib/amountInWords";
import { PrintButton } from "@/components/print-button";

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimate = await getEstimate(id);
  if (!estimate) notFound();

  const lineItems = estimate.lineItems as unknown as EstimateLineItem[];
  const subtotal = Number(estimate.subtotal);
  const gstAmount = Number(estimate.gstAmount);
  const totalAmount = Number(estimate.totalAmount);
  const subsidyEstimate = estimate.subsidyEstimate ? Number(estimate.subsidyEstimate) : null;
  const netPayable = subsidyEstimate !== null ? totalAmount - subsidyEstimate : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="border bg-background p-8 print:border-0 print:p-0">
        <div className="border-b-4 border-primary pb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{estimate.tenant.name}</h1>
        </div>

        <h2 className="mt-4 text-center text-lg font-semibold underline">Solar System Estimate</h2>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-1/4 border bg-muted/50 p-2 font-semibold">Customer Name</td>
              <td className="border p-2">{estimate.lead.customerName}</td>
              <td className="w-1/4 border bg-muted/50 p-2 font-semibold">Estimate No.</td>
              <td className="border p-2">{estimate.estimateNumber}</td>
            </tr>
            <tr>
              <td className="border bg-muted/50 p-2 font-semibold">Phone / Email</td>
              <td className="border p-2">
                {estimate.lead.phone}
                {estimate.lead.email ? ` · ${estimate.lead.email}` : ""}
              </td>
              <td className="border bg-muted/50 p-2 font-semibold">Estimate Date</td>
              <td className="border p-2">{estimate.createdAt.toLocaleDateString("en-IN")}</td>
            </tr>
            <tr>
              <td className="border bg-muted/50 p-2 font-semibold">System Size</td>
              <td className="border p-2">{estimate.systemSizeKw ? `${estimate.systemSizeKw} kW` : "—"}</td>
              <td className="border bg-muted/50 p-2 font-semibold">Valid Until</td>
              <td className="border p-2">
                {estimate.validUntil ? estimate.validUntil.toLocaleDateString("en-IN") : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="border p-2 text-left">S.No</th>
              <th className="border p-2 text-left">Description</th>
              <th className="border p-2 text-left">Specification / Details</th>
              <th className="border p-2 text-right">Qty</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2">{item.description}</td>
                <td className="border p-2">{item.spec}</td>
                <td className="border p-2 text-right">{item.qty}</td>
                <td className="border p-2 text-right">{money(item.rate)}</td>
                <td className="border p-2 text-right font-medium">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <table className="w-80 border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border bg-muted/50 p-2 font-semibold">Subtotal</td>
                <td className="border p-2 text-right">₹ {money(subtotal)}</td>
              </tr>
              <tr>
                <td className="border bg-muted/50 p-2 font-semibold">GST ({estimate.gstPercent.toString()}%)</td>
                <td className="border p-2 text-right">₹ {money(gstAmount)}</td>
              </tr>
              <tr className="bg-primary text-primary-foreground">
                <td className="border p-2 font-semibold">GRAND TOTAL</td>
                <td className="border p-2 text-right font-semibold">₹ {money(totalAmount)}</td>
              </tr>
              {subsidyEstimate !== null && (
                <>
                  <tr>
                    <td className="border bg-muted/50 p-2 font-semibold">Est. Government Subsidy</td>
                    <td className="border p-2 text-right">− ₹ {money(subsidyEstimate)}</td>
                  </tr>
                  <tr>
                    <td className="border bg-muted/50 p-2 font-semibold">Net Payable (after subsidy)</td>
                    <td className="border p-2 text-right font-semibold">₹ {money(netPayable!)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border p-2 text-sm">
          <strong>Amount in Words: </strong>
          {amountInWords(totalAmount)}
        </div>

        <div className="mt-8 border-t-2 pt-3">
          <h3 className="font-semibold">Terms &amp; Conditions</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {estimate.notes ||
              `1. Prices are subject to the specifications mentioned in this estimate.
2. Material quantity may vary as per site conditions.
3. Installation and commissioning shall be carried out as agreed with the customer.
4. Payment terms shall be mutually agreed between the customer and ${estimate.tenant.name}.
5. Estimate validity: as stated above from the date of issue.
6. Warranty will be as per the respective manufacturer's / installer's standard warranty terms.
7. Any additional work or material not mentioned in this estimate will be charged separately.
8. Final government subsidy amount is subject to scheme eligibility and approval; the figure above is indicative only.`}
          </p>
        </div>

        <div className="mt-14 flex justify-between text-sm">
          <div className="w-2/5 border-t pt-2 text-center">Customer Signature</div>
          <div className="w-2/5 border-t pt-2 text-center">
            For {estimate.tenant.name}
            <br />
            <br />
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
}
