import { createHmac } from "node:crypto";

// Every 5 minutes: asks the platform to send queued invoices and credit notes
// to Xero. Needs XERO_CLIENT_SECRET in Netlify (the key is made from it, the
// same way as src/lib/xero/client.ts).
async function xeroSync() {
  const secret = process.env.XERO_CLIENT_SECRET;
  const site = process.env.URL;
  if (!secret || !site) {
    console.log("Xero sync skipped: XERO_CLIENT_SECRET or URL not set");
    return;
  }
  const key = createHmac("sha256", secret).update("footprintos-xero:db").digest("hex");
  const res = await fetch(`${site}/api/cron/xero-sync`, { method: "POST", headers: { "x-sync-key": key } });
  console.log(`Xero sync: ${res.status} ${await res.text()}`);
}

export default xeroSync;

export const config = { schedule: "*/5 * * * *" };
