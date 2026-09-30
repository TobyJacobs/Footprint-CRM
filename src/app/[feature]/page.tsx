import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { features, findFeature } from "@/lib/features";

// Placeholder page for each feature until its wave is built. Each feature
// gets its own folder (e.g. src/app/customers) when real work starts on it,
// which takes priority over this catch-all.
export const dynamicParams = false;

export function generateStaticParams() {
  return features.map((f) => ({ feature: f.href.slice(1) }));
}

export async function generateMetadata(
  props: PageProps<"/[feature]">,
): Promise<Metadata> {
  const { feature } = await props.params;
  return { title: findFeature(feature)?.label };
}

export default async function FeaturePlaceholder(props: PageProps<"/[feature]">) {
  const { feature: slug } = await props.params;
  const feature = findFeature(slug);
  if (!feature) notFound();

  return (
    <>
      <PageHeader title={feature.label} intro={feature.description} />
      <div className="px-6 py-8 lg:px-10">
        <div className="max-w-xl rounded-lg border border-dashed border-fp-mid/40 bg-white p-6">
          <p className="font-bold">Coming in Wave {feature.wave}</p>
          {feature.replaces && (
            <p className="mt-1 text-sm text-fp-dark/75">
              This section will replace {feature.replaces}.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
