import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { features } from "@/lib/features";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Welcome to the Footprint Platform"
        intro="Everything Footprint Group runs on, in one secure place. Sections switch on wave by wave as they're built."
      />
      <div className="grid gap-4 px-6 py-8 sm:grid-cols-2 lg:px-10 xl:grid-cols-3">
        {features.map((f) => {
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
                  Wave {f.wave}
                </span>
              </div>
              <h2 className="mt-4 font-bold group-hover:text-fp-pink">{f.label}</h2>
              <p className="mt-1 text-sm text-fp-dark/75">{f.description}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}
