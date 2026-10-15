import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { Notice, dangerButton } from "@/components/ui";
import { getCurrentUser, requirePermission } from "@/lib/auth";
import { shortDateTime } from "@/lib/customers/display";
import { createClient } from "@/lib/supabase/server";
import { deleteContent, saveContent } from "../../actions";
import ContentForm from "../ContentForm";

export const metadata: Metadata = { title: "Content" };

export default async function ContentItemPage(props: PageProps<"/marketing/content/[id]">) {
  await requirePermission("marketing", "edit");
  const user = await getCurrentUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: item }, { data: people }] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, title, channel, status, publish_date, assignee_id, link, notes, published_at, customers(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
  ]);
  if (!item) notFound();
  const customer = item.customers as unknown as { id: string; name: string } | null;
  const month = item.publish_date ? item.publish_date.slice(0, 7) : null;
  const back = month ? `/marketing/content?month=${month}` : "/marketing/content";

  return (
    <>
      <Link href={back} className="text-sm font-semibold text-fp-teal-deep hover:underline">
        ← Content calendar
      </Link>
      <h2 className="mb-1 mt-3 text-xl font-black">{item.title}</h2>
      {item.published_at && <p className="mb-4 text-sm text-fp-mid">Published {shortDateTime(item.published_at)}</p>}
      <div className="mt-4">
        <Notice searchParams={sp} />
      </div>
      <ContentForm
        action={saveContent.bind(null, item.id)}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name ?? p.email }))}
        values={{ ...item, customer }}
        back={back}
        submitLabel="Save changes"
      />
      {user.can("marketing", "delete") && (
        <form action={deleteContent.bind(null, item.id)} className="mt-6">
          <ConfirmSubmit message="Delete this content from the calendar?" className={dangerButton}>
            Delete
          </ConfirmSubmit>
        </form>
      )}
    </>
  );
}
