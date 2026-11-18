"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A page-turning flipbook built from the issue's page files (one PDF, JPG or
// PNG per page). PDF.js (Mozilla's PDF reader) draws PDF pages; StPageFlip
// turns them. Pages are drawn as they come near, so a big issue opens quickly.
// On a narrow screen it shows one page at a time.
const PAGE_WIDTH = 560;

type PageFile = { url: string; type: string };

export default function Flipbook({ pages: files, title }: { pages: PageFile[]; title: string }) {
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
        const loadings: { destroy: () => Promise<void> }[] = [];
        const openPdf = async (url: string) => {
          const loading = pdfjs.getDocument({ url });
          loadings.push(loading);
          return (await loading.promise).getPage(1);
        };
        const loadImage = (url: string) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        if (files.length === 0) throw new Error("No pages");

        // The first page sets the shape of the book.
        const first = files[0];
        let ratio: number;
        if (first.type === "application/pdf") {
          const vp = (await openPdf(first.url)).getViewport({ scale: 1 });
          ratio = vp.height / vp.width;
        } else {
          const img = await loadImage(first.url);
          ratio = img.naturalHeight / img.naturalWidth;
        }
        if (cancelled || !bookRef.current) return;
        const pageHeight = Math.round(PAGE_WIDTH * ratio);

        // One empty page element per file; each is drawn when needed. The
        // book gets its own element, as StPageFlip removes it when closed.
        const host = document.createElement("div");
        bookRef.current.replaceChildren(host);
        const pages: HTMLDivElement[] = files.map((_, i) => {
          const div = document.createElement("div");
          div.className = "bg-white";
          div.dataset.page = String(i + 1);
          host.appendChild(div);
          return div;
        });

        const drawn = new Set<number>();
        const draw = async (n: number) => {
          if (n < 1 || n > files.length || drawn.has(n)) return;
          drawn.add(n);
          const file = files[n - 1];
          const div = pages[n - 1];
          if (file.type === "application/pdf") {
            const page = await openPdf(file.url);
            const scale = (PAGE_WIDTH / page.getViewport({ scale: 1 }).width) * Math.min(2, window.devicePixelRatio || 1);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement("canvas");
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.setAttribute("aria-label", `Page ${n}`);
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            div.replaceChildren(canvas);
            await page.render({ canvas, viewport }).promise;
          } else {
            const img = document.createElement("img");
            img.src = file.url;
            img.alt = `Page ${n}`;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain";
            div.replaceChildren(img);
          }
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
        setState({ status: "ready", pages: files.length, current: 0 });

        const onKey = (e: KeyboardEvent) => {
          if (e.key === "ArrowRight") flip.flipNext();
          if (e.key === "ArrowLeft") flip.flipPrev();
        };
        window.addEventListener("keydown", onKey);
        cleanup = () => {
          window.removeEventListener("keydown", onKey);
          flip.destroy();
          for (const l of loadings) void l.destroy();
        };
      } catch (err) {
        console.error("Flipbook couldn't open the pages:", err);
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
      flipRef.current = null;
    };
  }, [files]);

  return (
    <div className="grid gap-3">
      {state.status === "loading" && <p className="py-20 text-center text-sm text-fp-mid">Opening the magazine…</p>}
      {state.status === "error" && (
        <p className="py-20 text-center text-sm">
          Sorry, the magazine couldn&apos;t be opened here. Please try again later.
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
        </div>
      )}
    </div>
  );
}
