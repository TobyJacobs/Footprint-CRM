import type { Metadata } from "next";
import ReadView, { flipbookTitle, loadFlipbook } from "../ReadView";

// An edition's latest issue as a flipbook (the address for "Read online").
export async function generateMetadata(props: PageProps<"/read/[edition]">): Promise<Metadata> {
  const { edition } = await props.params;
  const book = await loadFlipbook(edition, null);
  return { title: { absolute: book ? flipbookTitle(book) : "Forget Me Not" }, robots: { index: false, follow: false } };
}

export default async function LatestIssuePage(props: PageProps<"/read/[edition]">) {
  const { edition } = await props.params;
  const { embed } = await props.searchParams;
  return <ReadView book={await loadFlipbook(edition, null)} embed={embed === "1"} />;
}
