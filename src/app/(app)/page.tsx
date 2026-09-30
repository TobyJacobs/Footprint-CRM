import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { features } from "@/lib/features";

export default async function Home(props: PageProps<"/">) {
  const user = await getCurrentUser();
  const { error } = await props.searchParams;
  const visible = features.filter((f) => user.visibleFeatureKeys.includes(f.key));
  const firstName = (user.fullName ?? "").split(" ")[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome, ${firstName}` : "Welcome to the Footprint Platform"}
        intro="Everything Footprint Group runs on, in one secure place. Sections switch on wave by wave as they're built."
      />
      {error === "forbidden" && (
        <p className="mx-6 mt-6 rounded-md border border-fp-error/30 bg-fp-error/5 px-4 py-3 text-sm text-fp-error lg:mx-10">
          You don&apos;t have access to that page.
        </p>
      )}
      {visible.length === 0 ? (
        <div className="px-6 py-8 lg:px-10">
          <div className="max-w-xl rounded-lg border border-fp-border bg-white p-6">
            <p className="font-bold">You&apos;re signed in, but no sections are switched on for you yet</p>
            <p className="mt-1 text-sm text-fp-dark/75">
              An admin needs to give you a role. Let them know you&apos;ve signed in.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 px-6 py-8 sm:grid-cols-2 lg:px-10 xl:grid-cols-3">
          {visible.map((f) => {
            const Icon = f.icon;
            return (
              <Link
                key={f.key}
                href={f.href}
                className="group rounded-lg border border-fp-border bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <Icon size={22} className="text-fp-pink" aria-hidden />
                  <span className="rounded-full bg-fp-light px-2.5 py-0.5 text-xs font-semibold text-fp-dark">
                    {f.key === "admin" ? "Ready" : `Wave ${f.wave}`}
                  </span>
                </div>
                <h2 className="mt-4 font-bold group-hover:text-fp-pink">{f.label}</h2>
                <p className="mt-1 text-sm text-fp-dark/75">{f.description}</p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
