import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";

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
      {children}
    </AppShell>
  );
}
