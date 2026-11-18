"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// On a phone the month grid needs sideways scrolling, so open the list view
// instead — unless someone has picked a view themselves.
export default function PhoneListView() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (search.has("view") || window.innerWidth >= 768) return;
    const next = new URLSearchParams(search.toString());
    next.set("view", "list");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [pathname, router, search]);

  return null;
}
