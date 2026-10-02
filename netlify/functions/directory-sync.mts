// Runs once a day: asks the platform to refresh the staff list from
// Microsoft 365 (new starters, job title changes, leavers).
// Needs DIRECTORY_SYNC_KEY in Netlify (created in Admin → Microsoft 365).
async function directorySync() {
  const key = process.env.DIRECTORY_SYNC_KEY;
  const site = process.env.URL;
  if (!key || !site) {
    console.log("Directory sync skipped: DIRECTORY_SYNC_KEY or URL not set");
    return;
  }
  const res = await fetch(`${site}/api/cron/directory-sync`, { method: "POST", headers: { "x-sync-key": key } });
  console.log(`Directory sync: ${res.status} ${await res.text()}`);
}

export default directorySync;

export const config = { schedule: "0 5 * * *" };
