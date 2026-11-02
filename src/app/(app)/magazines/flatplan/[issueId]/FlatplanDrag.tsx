"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { PAGE_H, PAGE_W } from "@/lib/magazine-options";
import { moveFlatplanItem, placeAdvert } from "../../actions";

// Drag an advert or editorial item onto a page, to the spot where it should go
// (or to a new spot on the same page). Same browser drag and drop as the
// Design board; on phones and tablets the "Put on page" / "Move to page"
// boxes do the job (the item is then laid out automatically on that page).
const SNAP = 5;

type Drag = {
  kind: "line" | "item";
  id: string;
  // Item size in mm, and where on it the mouse grabbed it (0 to 1 across/down).
  w: number;
  h: number;
  grabX: number;
  grabY: number;
} | null;

const FlatplanContext = createContext<{
  drag: Drag;
  setDrag: (d: Drag) => void;
  moving: string | null;
  drop: (page: number, xMm: number, yMm: number) => void;
} | null>(null);

export function FlatplanDrag({ issueId, children }: { issueId: string; children: ReactNode }) {
  const [drag, setDrag] = useState<Drag>(null);
  // The item being saved, greyed out until the page reloads with it in place.
  const [moving, setMoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(page: number, xMm: number, yMm: number) {
    if (!drag) return;
    // Top-left corner from where the mouse let go, snapped to 5 mm and kept on the page.
    const snap = (v: number, max: number) => Math.max(0, Math.min(Math.max(0, max), Math.round(v / SNAP) * SNAP));
    const x = snap(xMm - drag.grabX * drag.w, PAGE_W - drag.w);
    const y = snap(yMm - drag.grabY * drag.h, PAGE_H - drag.h);
    const fd = new FormData();
    fd.set("page", String(page));
    fd.set("x_mm", String(x));
    fd.set("y_mm", String(y));
    const { kind, id } = drag;
    setMoving(id);
    setDrag(null);
    startTransition(() => (kind === "line" ? placeAdvert(issueId, id, fd) : moveFlatplanItem(issueId, id, fd)));
  }

  return <FlatplanContext.Provider value={{ drag, setDrag, moving, drop }}>{children}</FlatplanContext.Provider>;
}

// One page drawn to scale (130 × 190 mm). Items inside are placed with
// percentages, so the page can be any size on screen.
export function DropPage({ page, className, children }: { page: number; className: string; children: ReactNode }) {
  const plan = useContext(FlatplanContext);
  const [over, setOver] = useState(false);
  const canDrop = !!plan?.drag;
  return (
    <section
      aria-label={`Page ${page}`}
      onDragOver={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const r = e.currentTarget.getBoundingClientRect();
        plan?.drop(page, ((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * PAGE_H);
      }}
      style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}
      className={`relative w-full overflow-hidden ${className} ${over && canDrop ? "ring-2 ring-fp-pink" : ""}`}
    >
      {children}
    </section>
  );
}

export function DragItem({
  kind,
  id,
  w,
  h,
  canDrag,
  className,
  style,
  title,
  children,
}: {
  kind: "line" | "item";
  id: string;
  w: number;
  h: number;
  canDrag: boolean;
  className: string;
  style?: React.CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  const plan = useContext(FlatplanContext);
  const busy = plan?.moving === id || plan?.drag?.id === id;
  return (
    <div
      draggable={canDrag && plan?.moving !== id}
      onDragStart={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        // Inside a page the item is drawn to scale, so remember where it was
        // grabbed; from the list it's dropped by its top-left corner.
        const onPage = kind === "item";
        plan?.setDrag({
          kind,
          id,
          w,
          h,
          grabX: onPage ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0,
          grabY: onPage ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0,
        });
      }}
      onDragEnd={() => plan?.setDrag(null)}
      aria-busy={plan?.moving === id || undefined}
      title={title}
      style={style}
      className={`${className} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}
