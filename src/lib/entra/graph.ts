import "server-only";

// Reads the staff list from Microsoft 365 (Microsoft Graph), using the
// "Footprint Platform" app's own permission (User.Read.All, read-only).
//
// Settings (Netlify environment variables, and .env.local on your computer):
//   ENTRA_TENANT_ID      — the Microsoft 365 tenant (directory) ID. Not secret.
//   ENTRA_CLIENT_ID      — the "Footprint Platform" app's client ID. Not secret.
//   ENTRA_CLIENT_SECRET  — SECRET; a client secret created on that app.
//   STAFF_EMAIL_DOMAINS  — optional, comma-separated; defaults to footprintgroup.uk.

export type DirectoryUser = {
  id: string;
  email: string;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  accountEnabled: boolean;
};

export const isDirectoryConfigured = () =>
  Boolean(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET);

export const staffDomains = () =>
  (process.env.STAFF_EMAIL_DOMAINS || "footprintgroup.uk")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

async function getToken(): Promise<string> {
  const tenant = process.env.ENTRA_TENANT_ID!;
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.ENTRA_CLIENT_ID!,
      client_secret: process.env.ENTRA_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Microsoft sign-in for the sync failed: ${body.error_description?.split("\r\n")[0] ?? res.status}`);
  }
  return body.access_token;
}

type GraphUser = {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  accountEnabled: boolean | null;
  userType: string | null;
};

// Everyone in Microsoft 365 with a staff email address (guests are left out).
export async function listStaff(): Promise<DirectoryUser[]> {
  const token = await getToken();
  const domains = staffDomains();
  const select = "id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,accountEnabled,userType";
  let url: string | null = `https://graph.microsoft.com/v1.0/users?$select=${select}&$top=999`;
  const out: DirectoryUser[] = [];

  for (let page = 0; url && page < 50; page++) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as {
      value?: GraphUser[];
      "@odata.nextLink"?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(
        res.status === 403
          ? "Microsoft refused: the app needs the User.Read.All permission with admin consent."
          : `Microsoft Graph error: ${body.error?.message ?? res.status}`,
      );
    }
    for (const u of body.value ?? []) {
      const email = (u.mail || u.userPrincipalName || "").trim().toLowerCase();
      const domain = email.split("@")[1] ?? "";
      if (u.userType === "Guest" || !domains.includes(domain)) continue;
      out.push({
        id: u.id,
        email,
        displayName: u.displayName,
        jobTitle: u.jobTitle,
        department: u.department,
        officeLocation: u.officeLocation,
        accountEnabled: u.accountEnabled !== false,
      });
    }
    url = body["@odata.nextLink"] ?? null;
  }
  return out;
}
