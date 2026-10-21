import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PrintableData } from "@/components/PrintableDocument";
import { gbp, longDate } from "@/lib/customers/display";
import { footprintLogoDataUri } from "./logo";

// The same A4 layout as the printable page (components/PrintableDocument),
// made as a PDF file on the server so it can be downloaded and attached to
// emails. Uses the built-in Helvetica font.

const pink = "#de2277";
const mid = "#888888";
const border = "#e8e8e8";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#000" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 3, borderBottomColor: "#000", paddingBottom: 14 },
  logo: { width: 150, height: 44 },
  company: { textAlign: "right", fontSize: 8.5, color: "#444", lineHeight: 1.4 },
  bold: { fontFamily: "Helvetica-Bold" },
  stripe: { height: 3, backgroundColor: pink, marginBottom: 18 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  label: { fontSize: 7.5, color: mid, textTransform: "uppercase", letterSpacing: 0.5 },
  customerName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 3 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2 },
  metaKey: { color: mid, width: 80, textAlign: "right", marginRight: 10 },
  metaVal: { width: 110, textAlign: "right" },
  box: { backgroundColor: "#f7f7f7", padding: 8, marginBottom: 10 },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 8 },
  th: { flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#000", paddingBottom: 4, fontSize: 7.5, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: border, paddingVertical: 5 },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 40, textAlign: "right" },
  cPrice: { width: 70, textAlign: "right" },
  cVat: { width: 40, textAlign: "right" },
  cAmt: { width: 75, textAlign: "right" },
  discount: { fontSize: 7.5, color: mid, marginTop: 2 },
  totals: { marginTop: 10, marginLeft: "auto", width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: "#000", paddingTop: 4, marginTop: 2, fontSize: 11, fontFamily: "Helvetica-Bold" },
  section: { marginTop: 16 },
  text: { marginTop: 3, lineHeight: 1.4 },
  terms: { marginTop: 3, fontSize: 8, color: "#444", lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: border, paddingTop: 6, fontSize: 7.5, color: mid, flexDirection: "row", justifyContent: "space-between" },
});

const money = (n: number) => gbp(n) ?? "";

function DocumentPdf({ d }: { d: PrintableData }) {
  const c = d.company ?? {};
  const metas: [string, string | null | undefined, boolean?][] = [
    [d.label, d.number, true],
    ["Date", longDate(d.issue_date)],
    ["Valid until", d.valid_until ? longDate(d.valid_until) : null],
    ["Payment due", d.due_date ? longDate(d.due_date) : null, true],
    ["Your reference", d.customer_reference],
  ];
  const footer = [c.company_number && `Registered in England & Wales no. ${c.company_number}`, c.vat_number && `VAT no. ${c.vat_number}`].filter(Boolean).join(" · ");
  return (
    <Document title={`${d.label} ${d.number}`} author={c.company_name ?? "Footprint Group"}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */}
          <Image src={footprintLogoDataUri} style={s.logo} />
          <View style={s.company}>
            {c.company_name ? <Text style={s.bold}>{c.company_name}</Text> : null}
            {c.address ? <Text>{c.address}</Text> : null}
            {[c.phone, c.email, c.website].filter(Boolean).map((x) => (
              <Text key={x as string}>{x}</Text>
            ))}
          </View>
        </View>
        <View style={s.stripe} />

        <View style={s.meta}>
          <View>
            <Text style={s.label}>{d.forLabel ?? `${d.label} for`}</Text>
            <Text style={s.customerName}>{d.customer.name}</Text>
            {d.customer.contact ? <Text>FAO {d.customer.contact}</Text> : null}
            {d.customer.address ? <Text style={{ color: "#444", marginTop: 2 }}>{d.customer.address}</Text> : null}
          </View>
          <View>
            {metas
              .filter(([, v]) => v)
              .map(([k, v, strong]) => (
                <View key={k} style={s.metaRow}>
                  <Text style={s.metaKey}>{k}</Text>
                  <Text style={strong ? [s.metaVal, s.bold] : s.metaVal}>{v}</Text>
                </View>
              ))}
          </View>
        </View>

        {d.reason ? (
          <View style={s.box}>
            <Text>
              <Text style={s.bold}>Reason for credit: </Text>
              {d.reason}
            </Text>
          </View>
        ) : null}

        {d.title ? <Text style={s.title}>{d.title}</Text> : null}

        <View style={s.th} fixed>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cPrice}>Price</Text>
          <Text style={s.cVat}>VAT</Text>
          <Text style={s.cAmt}>Amount</Text>
        </View>
        {d.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={s.cDesc}>
              <Text>{l.description}</Text>
              {l.discount_percent > 0 ? <Text style={s.discount}>Includes {l.discount_percent}% discount</Text> : null}
            </View>
            <Text style={s.cQty}>{l.quantity}</Text>
            <Text style={s.cPrice}>{money(l.unit_price)}</Text>
            <Text style={s.cVat}>{l.tax_rate}%</Text>
            <Text style={s.cAmt}>{money(l.line_net)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text>Subtotal</Text>
            <Text>{money(d.subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>VAT</Text>
            <Text>{money(d.vat_total)}</Text>
          </View>
          <View style={s.grand}>
            <Text>Total</Text>
            <Text>{money(d.total)}</Text>
          </View>
        </View>

        {d.notes ? (
          <View style={s.section}>
            <Text style={s.label}>Notes</Text>
            <Text style={s.text}>{d.notes}</Text>
          </View>
        ) : null}
        {d.bank_details ? (
          <View style={s.section} wrap={false}>
            <Text style={s.label}>How to pay</Text>
            <Text style={s.text}>{d.bank_details}</Text>
          </View>
        ) : null}
        {d.terms ? (
          <View style={s.section}>
            <Text style={s.label}>Terms</Text>
            <Text style={s.terms}>{d.terms}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>{footer}</Text>
          <Text render={({ pageNumber, totalPages }) => (totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : "")} />
        </View>
      </Page>
    </Document>
  );
}

// The PDF file for a document, e.g. to download or attach to an email.
export function renderDocumentPdf(d: PrintableData): Promise<Buffer> {
  return renderToBuffer(<DocumentPdf d={d} />);
}

export const pdfFileName = (d: PrintableData) => `${d.label} ${d.number}.pdf`.replace(/[^\w .-]+/g, "-");
