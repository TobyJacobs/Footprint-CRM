"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

// Shows that FootprintOS is working the moment someone clicks: a thin pink bar
// runs along the top of the screen, and the button that sent a form dims and
// shows a small spinner. Both clear when the next page (or the saved page) has
// arrived. The bar is switched on and off directly, without re-rendering.
export default function ActivityBar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const bar = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});

  // A new page (or new filters) has arrived: stop.
  useEffect(() => {
    stopRef.current();
  }, [pathname, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;
    const stop = () => {
      bar.current?.classList.remove("is-busy");
      clearTimeout(timer);
      observer?.disconnect();
      document.querySelectorAll("[data-pending]").forEach((el) => el.removeAttribute("data-pending"));
    };
    stopRef.current = stop;

    const start = () => {
      bar.current?.classList.add("is-busy");
      clearTimeout(timer);
      observer?.disconnect();
      // A save that stays on the same page: stop once the page content changes.
      const main = document.querySelector("main");
      if (main) {
        const since = Date.now();
        observer = new MutationObserver(() => {
          if (Date.now() - since > 120) stop();
        });
        observer.observe(main, { childList: true, subtree: true, characterData: true });
      }
      // Never spin forever (e.g. a download).
      timer = setTimeout(stop, 12000);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or just a #section on it): nothing to load.
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };

    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      (e.submitter as HTMLElement | null)?.setAttribute("data-pending", "");
      start();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      stop();
    };
  }, []);

  return <div ref={bar} aria-hidden className="fp-activity-bar" />;
}
