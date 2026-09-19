import { notFound } from "next/navigation";
import { getInvoice } from "@/server/invoices";
import type { InvoiceLineItem } from "@/server/invoices";
import { amountInWords } from "@/lib/amountInWords";
import { DEFAULT_ESTIMATE_TERMS } from "@/lib/estimateDefaults";
import { PrintButton } from "@/components/print-button";

function money(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const lineItems = invoice.lineItems as unknown as InvoiceLineItem[];
  const subtotal = Number(invoice.subtotal);
  const gstAmount = Number(invoice.gstAmount);
  const totalAmount = Number(invoice.totalAmount);
  const lead = invoice.connection.lead;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <style>{"@page { size: A4 portrait; margin: 7mm; }"}</style>

      <div className="print:hidden">
        <PrintButton />
      </div>

      <div className="border bg-background p-8 print:border-0 print:p-0">
        <div className="border-b-[3px] border-[#16823b] pb-4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-[#08752f]">{invoice.tenant.name}</h1>
          {invoice.tenant.businessAddress && <p className="mt-1 text-sm">{invoice.tenant.businessAddress}</p>}
          <p className="mt-1 text-sm font-medium">
            {invoice.tenant.gstin && <span className="text-[#b00000]">GST NO: {invoice.tenant.gstin}</span>}
            {invoice.tenant.gstin && (invoice.tenant.contactPhone || invoice.tenant.contactEmail) ? " | " : ""}
            {invoice.tenant.contactPhone && `PHONE: ${invoice.tenant.contactPhone}`}
            {invoice.tenant.contactPhone && invoice.tenant.contactEmail ? " | " : ""}
            {invoice.tenant.contactEmail && `EMAIL: ${invoice.tenant.contactEmail}`}
          </p>
        </div>

        <h2 className="mt-4 text-center text-lg font-semibold underline">Tax Invoice</h2>

        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-1/4 border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Customer Name</td>
              <td className="border border-[#aaa] p-2">{lead.customerName}</td>
              <td className="w-1/4 border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Invoice No.</td>
              <td className="border border-[#aaa] p-2">{invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Customer Address</td>
              <td className="border border-[#aaa] p-2" colSpan={3}>
                {lead.address || "—"}
              </td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Invoice Date</td>
              <td className="border border-[#aaa] p-2">{invoice.invoiceDate.toLocaleDateString("en-IN")}</td>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">System Size</td>
              <td className="border border-[#aaa] p-2">
                {invoice.connection.systemSizeKw ? `${invoice.connection.systemSizeKw} kW` : "—"}
              </td>
            </tr>
            <tr>
              <td className="border border-[#aaa] bg-[#f2f7f3] p-2 font-semibold">Phone / Email</td>
              <td className="border border-[#aaa] p-2" colSpan={3}>
                {lead.phone}
                {lead.email ? ` · ${lead.email}` : ""}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#16823b] text-white">
              <th className="border border-[#0c5b29] p-2 text-left">S.No</th>
              <th className="border border-[#0c5b29] p-2 text-left">Description</th>
              <th className="border border-[#0c5b29] p-2 text-left">Specification / Details</th>
              <th className="border border-[#0c5b29] p-2 text-left">Brand</th>
              <th className="border border-[#0c5b29] p-2 text-right">Qty</th>
              <th className="border border-[#0c5b29] p-2 text-right">Rate</th>
              <th className="border border-[#0c5b29] p-2 text-right">GST %</th>
              <th className="border border-[#0c5b29] p-2 text-right">Amount</th>
              <th className="border border-[#0c5b29] p-2 text-right">Incl. GST</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => {
              // Older invoices saved before per-item GST existed fall back
              // to the invoice's own (then-flat) GST% rather than 0.
              const itemGstPercent = item.gstPercent ?? Number(invoice.gstPercent);
              const itemGstAmount = item.amount * (itemGstPercent / 100);
              return (
                <tr key={i}>
                  <td className="border border-[#999] p-2">{i + 1}</td>
                  <td className="border border-[#999] p-2">{item.description}</td>
                  <td className="border border-[#999] p-2">{item.spec}</td>
                  <td className="border border-[#999] p-2">{item.brand || "—"}</td>
                  <td className="border border-[#999] p-2 text-right">{item.qty}</td>
                  <td className="border border-[#999] p-2 text-right">{money(item.rate)}</td>
                  <td className="border border-[#999] p-2 text-right">{itemGstPercent}%</td>
                  <td className="border border-[#999] p-2 text-right font-medium">{money(item.amount)}</td>
                  <td className="border border-[#999] p-2 text-right font-medium">
                    {money(item.amount + itemGstAmount)}
                  </td>
                </tr>
              );
            })}
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
                  GST (avg {money(Number(invoice.gstPercent))}%)
                </td>
                <td className="border border-[#999] p-2 text-right">₹ {money(gstAmount)}</td>
              </tr>
              <tr className="bg-[#16823b] text-white">
                <td className="border border-[#0c5b29] p-2 font-semibold">GRAND TOTAL</td>
                <td className="border border-[#0c5b29] p-2 text-right font-semibold">₹ {money(totalAmount)}</td>
              </tr>
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
            {invoice.notes || DEFAULT_ESTIMATE_TERMS}
          </p>
        </div>

        <div className="mt-14 flex justify-between text-sm">
          <div className="w-2/5 border-t pt-2 text-center">Customer Signature</div>
          <div className="w-2/5 border-t pt-2 text-center">
            For {invoice.tenant.name}
            <br />
            <br />
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
}
