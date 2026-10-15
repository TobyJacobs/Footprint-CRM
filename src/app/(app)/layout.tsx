import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { stopPreview } from "./preview-actions";

// Everything inside (app) needs a signed-in, active user. Each page also
// checks its own permission — this layout only builds the menu.
export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <AppShell
      visibleFeatureKeys={user.visibleFeatureKeys}
      userName={user.fullName ?? user.email}
      userEmail={user.email}
    >
      {user.previewRole && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 border-b border-fp-amber bg-fp-amber/20 px-6 py-3 text-sm lg:px-10">
          <p>
            <strong>Previewing as {user.previewRole.name}.</strong> Menus, pages and buttons are as this role sees them. Records aren&apos;t
            filtered — you still see everything your own account can.
          </p>
          <form action={stopPreview}>
            <button type="submit" className="rounded-md bg-fp-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-fp-dark">
              Stop preview
            </button>
          </form>
        </div>
      )}
      {children}
    </AppShell>
  );
}
