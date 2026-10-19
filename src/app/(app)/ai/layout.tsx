import type { Metadata } from "next";
import NoAccess from "@/components/NoAccess";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import AiTabs from "./AiTabs";

export const metadata: Metadata = { title: "FootprintAI" };

// Invite only: admins, and people an admin has added to the list.
export default async function AiLayout({ children }: LayoutProps<"/ai">) {
  const user = await getCurrentUser();
  if (!user.can("ai", "view")) return <NoAccess title="FootprintAI" />;
  return (
    <>
      <PageHeader title="FootprintAI" intro="The agents and systems we're building and testing on ourselves first: where each one is, and how it's scoring." />
      <AiTabs isAdmin={user.isAdmin} />
      <div className="px-6 py-8 lg:px-10">{children}</div>
    </>
  );
}
