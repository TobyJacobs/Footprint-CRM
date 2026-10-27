"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

// A page-turning flipbook of a magazine PDF. PDF.js (Mozilla's PDF reader)
// draws each page; StPageFlip turns them. Pages are drawn as they come near,
// so a big issue opens quickly. On a narrow screen it shows one page at a time.
const PAGE_WIDTH = 560;

export default function Flipbook({ pdfUrl, title }: { pdfUrl: string; title: string }) {
  const bookRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<import("page-flip").PageFlip | null>(null);
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; pages: number; current: number }>({
    status: "loading",
    pages: 0,
    current: 0,
  });

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loading = pdfjs.getDocument({ url: pdfUrl });
        const doc = await loading.promise;
        if (cancelled || !bookRef.current) return;

        const first = await doc.getPage(1);
        const base = first.getViewport({ scale: 1 });
        const ratio = base.height / base.width;
        const pageHeight = Math.round(PAGE_WIDTH * ratio);

        // One empty page element per PDF page; each is drawn when needed. The
        // book gets its own element, as StPageFlip removes it when closed.
        const host = document.createElement("div");
        bookRef.current.replaceChildren(host);
        const pages: HTMLDivElement[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const div = document.createElement("div");
          div.className = "bg-white";
          div.dataset.page = String(n);
          const canvas = document.createElement("canvas");
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.setAttribute("aria-label", `Page ${n}`);
          div.appendChild(canvas);
          host.appendChild(div);
          pages.push(div);
        }

        const drawn = new Set<number>();
        const draw = async (n: number) => {
          if (n < 1 || n > doc.numPages || drawn.has(n)) return;
          drawn.add(n);
          const page = await doc.getPage(n);
          const scale = (PAGE_WIDTH / page.getViewport({ scale: 1 }).width) * Math.min(2, window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = pages[n - 1].querySelector("canvas")!;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvas, viewport }).promise;
        };
        const drawAround = (index: number) => {
          for (let n = index - 1; n <= index + 4; n++) void draw(n);
        };

        const { PageFlip } = await import("page-flip");
        if (cancelled) return;
        const flip = new PageFlip(host, {
          width: PAGE_WIDTH,
          height: pageHeight,
          size: "stretch",
          minWidth: 280,
          maxWidth: 900,
          minHeight: Math.round(280 * ratio),
          maxHeight: Math.round(900 * ratio),
          showCover: true,
          maxShadowOpacity: 0.4,
          mobileScrollSupport: true,
        });
        flip.loadFromHTML(pages);
        flipRef.current = flip;
        drawAround(1);
        // Keep the page counter and drawing in step after every turn.
        const sync = () => {
          const index = flip.getCurrentPageIndex();
          drawAround(index + 1);
          setState((s) => ({ ...s, current: index }));
        };
        flip.on("flip", sync);
        flip.on("changeState", (e) => {
          if (e.data === "read") sync();
        });
        setState({ status: "ready", pages: doc.numPages, current: 0 });

        const onKey = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") flip.flipNext();
          if (e.key === "ArrowLeft") flip.flipPrev();
        };
        window.addEventListener("keydown", onKey);
        cleanup = () => {
          window.removeEventListener("keydown", onKey);
          flip.destroy();
          void loading.destroy();
        };
      } catch (err) {
        console.error("Flipbook couldn't open the PDF:", err);
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
      flipRef.current = null;
    };
  }, [pdfUrl]);

  return (
    <div className="grid gap-3">
      {state.status === "loading" && <p className="py-20 text-center text-sm text-fp-mid">Opening the magazine…</p>}
      {state.status === "error" && (
        <p className="py-20 text-center text-sm">
          The magazine couldn&apos;t be opened here.{" "}
          <a href={pdfUrl} className="font-semibold text-fp-teal-deep underline">
            Open the PDF instead
          </a>
          .
        </p>
      )}
      <div className="mx-auto w-full max-w-[1800px]" aria-label={title}>
        <div ref={bookRef} />
      </div>
      {state.status === "ready" && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => flipRef.current?.flipPrev()}
            disabled={state.current === 0}
            aria-label="Previous page"
            className="rounded-full border border-fp-border bg-white p-2 disabled:opacity-40"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="min-w-28 text-center text-fp-dark/80">
            Page {state.current + 1} of {state.pages}
          </span>
          <button
            type="button"
            onClick={() => flipRef.current?.flipNext()}
            disabled={state.current >= state.pages - 1}
            aria-label="Next page"
            className="rounded-full border border-fp-border bg-white p-2 disabled:opacity-40"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <a href={pdfUrl} target="_blank" rel="noopener" className="ml-2 inline-flex items-center gap-1 font-semibold text-fp-teal-deep hover:underline">
            <Download size={14} aria-hidden /> PDF
          </a>
        </div>
      )}
    </div>
  );
}
