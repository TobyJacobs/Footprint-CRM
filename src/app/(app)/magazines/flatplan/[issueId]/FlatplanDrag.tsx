"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { moveFlatplanItem, placeAdvert } from "../../actions";

// Drag an advert or editorial item onto a page. Same browser drag and drop as
// the Design board; on phones and tablets the "Put on page" / "Move to page"
// boxes on each item do the same job.
type Drag = { kind: "line" | "item"; id: string; page: number | null } | null;

const FlatplanContext = createContext<{
  drag: Drag;
  setDrag: (d: Drag) => void;
  moving: string | null;
  drop: (page: number) => void;
} | null>(null);

export function FlatplanDrag({ issueId, children }: { issueId: string; children: ReactNode }) {
  const [drag, setDrag] = useState<Drag>(null);
  // The item being saved, greyed out until the page reloads with it in place.
  const [moving, setMoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(page: number) {
    if (!drag || drag.page === page) return;
    const fd = new FormData();
    fd.set("page", String(page));
    const { kind, id } = drag;
    setMoving(id);
    setDrag(null);
    startTransition(() => (kind === "line" ? placeAdvert(issueId, id, fd) : moveFlatplanItem(issueId, id, fd)));
  }

  return <FlatplanContext.Provider value={{ drag, setDrag, moving, drop }}>{children}</FlatplanContext.Provider>;
}

export function DropPage({ page, className, children }: { page: number; className: string; children: ReactNode }) {
  const plan = useContext(FlatplanContext);
  const [over, setOver] = useState(false);
  const canDrop = !!plan?.drag && plan.drag.page !== page;
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
        plan?.drop(page);
      }}
      className={`${className} ${over && canDrop ? "ring-2 ring-fp-pink" : ""}`}
    >
      {children}
    </section>
  );
}

export function DragItem({
  kind,
  id,
  page,
  canDrag,
  className,
  style,
  children,
}: {
  kind: "line" | "item";
  id: string;
  page: number | null;
  canDrag: boolean;
  className: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const plan = useContext(FlatplanContext);
  const busy = plan?.moving === id || plan?.drag?.id === id;
  return (
    <div
      draggable={canDrag && plan?.moving !== id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        plan?.setDrag({ kind, id, page });
      }}
      onDragEnd={() => plan?.setDrag(null)}
      aria-busy={plan?.moving === id || undefined}
      style={style}
      className={`${className} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}
