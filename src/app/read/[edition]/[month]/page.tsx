import type { Metadata } from "next";
import ReadView, { flipbookTitle, loadFlipbook } from "../../ReadView";

// One issue as a flipbook, e.g. /read/fareham/2026-11.
export async function generateMetadata(props: PageProps<"/read/[edition]/[month]">): Promise<Metadata> {
  const { edition, month } = await props.params;
  const book = await loadFlipbook(edition, month);
  return { title: { absolute: book ? flipbookTitle(book) : "Forget Me Not" }, robots: { index: false, follow: false } };
}

export default async function IssuePage(props: PageProps<"/read/[edition]/[month]">) {
  const { edition, month } = await props.params;
  const { embed } = await props.searchParams;
  return <ReadView book={await loadFlipbook(edition, month)} embed={embed === "1"} />;
}
