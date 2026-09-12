import { notFound } from "next/navigation";
import { getEstimate, type EstimateLineItem } from "@/server/leads";
import { amountInWords } from "@/lib/amountInWords";
import { brandLabel } from "@/lib/estimateBrands";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";
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
  const selectedBrandLabel = brandLabel(estimate.brand);
  const validityDays = estimate.validUntil
    ? Math.round((estimate.validUntil.getTime() - estimate.createdAt.getTime()) / 86400000)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <style>{"@page { size: A4 portrait; margin: 7mm; }"}</style>

      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="border bg-background p-8 print:border-0 print:p-0">
        <div className="border-b-[3px] border-[#16823b] pb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-[#08752f]">{estimate.tenant.name}</h1>
          {estimate.tenant.businessAddress && (
            <p className="mt-1 text-sm">{estimate.tenant.businessAddress}</p>
          )}
          <p className="mt-1 text-sm font-medium">
            {estimate.tenant.gstin && <span className="text-[#b00000]">GST NO: {estimate.tenant.gstin}</span>}
            {estimate.tenant.gstin && (estimate.tenant.contactPhone || estimate.tenant.contactEmail) ? " | " : ""}
            {estimate.tenant.contactPhone && `PHONE: ${estimate.tenant.contactPhone}`}
            {estimate.tenant.contactPhone && estimate.tenant.contactEmail ? " | " : ""}
            {estimate.tenant.contactEmail && `EMAIL: ${estimate.tenant.contactEmail}`}
          </p>
        </div>

        <h2 className="mt-4 text-center text-lg font-semibold underline">Solar System Estimate</h2>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-1/4 border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Customer Name</td>
              <td className="border border-[#aaa] p-2">{estimate.lead.customerName}</td>
              <td className="w-1/4 border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Quotation No.</td>
              <td className="border border-[#aaa] p-2">{estimate.estimateNumber}</td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Customer Address</td>
              <td className="border border-[#aaa] p-2" colSpan={3}>
                {estimate.lead.address || "—"}
              </td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Quotation Date</td>
              <td className="border border-[#aaa] p-2">{estimate.createdAt.toLocaleDateString("en-IN")}</td>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Validity</td>
              <td className="border border-[#aaa] p-2">
                {estimate.validUntil
                  ? `${estimate.validUntil.toLocaleDateString("en-IN")}${validityDays !== null ? ` (${validityDays} Days)` : ""}`
                  : "—"}
              </td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Phone / Email</td>
              <td className="border border-[#aaa] p-2" colSpan={3}>
                {estimate.lead.phone}
                {estimate.lead.email ? ` · ${estimate.lead.email}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-3 space-y-1">
          <p className="font-bold text-[#08752f]">
            System Capacity: {estimate.systemSizeKw ? `${estimate.systemSizeKw} kW` : "Not Selected"}
          </p>
          <p className="font-bold text-[#08752f]">
            Selected Brand: {selectedBrandLabel ?? "Not Selected"}
          </p>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#16823b] text-white">
              <th className="border border-[#0c5b29] p-2 text-left">S.No</th>
              <th className="border border-[#0c5b29] p-2 text-left">Description</th>
              <th className="border border-[#0c5b29] p-2 text-left">Specification / Details</th>
              <th className="border border-[#0c5b29] p-2 text-right">Qty</th>
              <th className="border border-[#0c5b29] p-2 text-right">Rate</th>
              <th className="border border-[#0c5b29] p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i}>
                <td className="border border-[#999] p-2">{i + 1}</td>
                <td className="border border-[#999] p-2">{item.description}</td>
                <td className="border border-[#999] p-2">{item.spec}</td>
                <td className="border border-[#999] p-2 text-right">{item.qty}</td>
                <td className="border border-[#999] p-2 text-right">{money(item.rate)}</td>
                <td className="border border-[#999] p-2 text-right font-medium">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <table className="w-80 border-collapse text-sm">
            <tbody>
              <tr>
                <td className="border border-[#999] bg-[#f2f7f3] p-2 font-semibold">Subtotal</td>
                <td className="border border-[#999] p-2 text-right">₹ {money(subtotal)}</td>
              </tr>
              <tr>
                <td className="border border-[#999] bg-[#f2f7f3] p-2 font-semibold">
                  GST ({estimate.gstPercent.toString()}%)
                </td>
                <td className="border border-[#999] p-2 text-right">₹ {money(gstAmount)}</td>
              </tr>
              <tr className="bg-[#16823b] text-white">
                <td className="border border-[#0c5b29] p-2 font-semibold">GRAND TOTAL</td>
                <td className="border border-[#0c5b29] p-2 text-right font-semibold">₹ {money(totalAmount)}</td>
              </tr>
              {subsidyEstimate !== null && (
                <>
                  <tr>
                    <td className="border border-[#999] bg-[#f2f7f3] p-2 font-semibold">Est. Government Subsidy</td>
                    <td className="border border-[#999] p-2 text-right">− ₹ {money(subsidyEstimate)}</td>
                  </tr>
                  <tr>
                    <td className="border border-[#999] bg-[#f2f7f3] p-2 font-semibold">Net Payable (after subsidy)</td>
                    <td className="border border-[#999] p-2 text-right font-semibold">₹ {money(netPayable!)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border border-[#ccc] p-2 text-sm">
          <strong>Amount in Words: </strong>
          {amountInWords(totalAmount)}
        </div>

        <div className="mt-8 border-t-2 border-[#16823b] pt-3">
          <h3 className="font-semibold text-[#08752f]">Terms &amp; Conditions</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {estimate.notes || DEFAULT_ESTIMATE_TERMS}
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
