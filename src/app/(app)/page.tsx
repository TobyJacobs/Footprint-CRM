import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import DirectorDashboard from "@/components/dashboards/DirectorDashboard";
import FinanceDashboard from "@/components/dashboards/FinanceDashboard";
import OperationsDashboard from "@/components/dashboards/OperationsDashboard";
import SalesDashboard from "@/components/dashboards/SalesDashboard";
import { getCurrentUser } from "@/lib/auth";
import { dashboardOrder, dashboardTypes, type DashboardType } from "@/lib/dashboards/data";
import { features } from "@/lib/features";

// The home page changes with the person's role(s): each role has a dashboard
// type (Admin → Roles). Someone with several roles gets a tab for each.
export default async function Home(props: PageProps<"/">) {
  const user = await getCurrentUser();
  const sp = await props.searchParams;
  const visible = features.filter((f) => user.visibleFeatureKeys.includes(f.key));
  const firstName = (user.fullName ?? "").split(" ")[0];

  // Which dashboards this person gets. Figures need the Quotes & Invoices
  // permission; admins without a role see the Directors' view.
  const canSeeFigures = user.can("quotes", "view");
  let mine = dashboardOrder.filter((d) => d !== "general" && user.dashboards.includes(d));
  if (mine.length === 0 && user.isAdmin) mine = ["director"];
  if (!canSeeFigures) mine = [];
  const requested = typeof sp.view === "string" ? (sp.view as DashboardType) : null;
  const view = requested && mine.includes(requested) ? requested : mine[0] ?? null;
  const label = (d: DashboardType) => dashboardTypes.find((t) => t.value === d)?.label ?? d;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome to the Footprint Platform"}
        intro={
          view
            ? `${label(view)} view · ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
            : "Everything Footprint Group runs on, in one secure place."
        }
      />
      {sp.error === "forbidden" && (
        <p className="mx-6 mt-6 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error lg:mx-10">
          You don&apos;t have access to that page.
        </p>
      )}

      {mine.length > 1 && (
        <nav aria-label="Dashboards" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-fp-border bg-white px-6 lg:px-10">
          {mine.map((d) => (
            <Link
              key={d}
              href={d === mine[0] ? "/" : `/?view=${d}`}
              aria-current={d === view ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold ${
                d === view ? "border-fp-pink text-fp-black" : "border-transparent text-fp-dark/60 hover:text-fp-black"
              }`}
            >
              {label(d)}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-8 px-6 py-8 lg:px-10">
        {view === "director" && <DirectorDashboard />}
        {view === "sales" && <SalesDashboard userId={user.id} />}
        {view === "finance" && <FinanceDashboard />}
        {view === "operations" && <OperationsDashboard />}

        {visible.length === 0 ? (
          <div className="max-w-xl rounded-lg border border-fp-border bg-white p-6">
            <p className="font-bold">You&apos;re signed in, but no sections are switched on for you yet</p>
            <p className="mt-1 text-sm text-fp-dark/75">An admin needs to give you a role. Let them know you&apos;ve signed in.</p>
          </div>
        ) : (
          <section>
            {view && <h2 className="mb-3 text-lg font-black">Your sections</h2>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((f) => {
                const Icon = f.icon;
                return (
                  <Link
                    key={f.key}
                    href={f.href}
                    className={`group rounded-lg border border-fp-border bg-white transition-shadow hover:shadow-md ${view ? "p-4" : "p-5"}`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={view ? 18 : 22} className="text-fp-pink" aria-hidden />
                      {!view && (
                        <span className="rounded-full bg-fp-light px-2.5 py-0.5 text-xs font-semibold text-fp-dark">
                          {f.key === "admin" ? "Ready" : `Wave ${f.wave}`}
                        </span>
                      )}
                    </div>
                    <h3 className={`font-bold group-hover:text-fp-pink ${view ? "mt-2" : "mt-4"}`}>{f.label}</h3>
                    {!view && <p className="mt-1 text-sm text-fp-dark/75">{f.description}</p>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
