"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { moveLead } from "./actions";

// Drag a lead card onto another stage. Same browser drag and drop as the
// Design board; on a phone, change the stage in the lead's panel.
type Drag = { id: string; stage: string } | null;

const LeadContext = createContext<{ drag: Drag; setDrag: (d: Drag) => void; moving: string | null; drop: (stage: string) => void } | null>(null);

export function LeadDrag({ back, children }: { back: string; children: ReactNode }) {
  const [drag, setDrag] = useState<Drag>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  function drop(stage: string) {
    if (!drag || drag.stage === stage) return;
    const { id } = drag;
    setMoving(id);
    setDrag(null);
    startTransition(() => moveLead(id, stage, back));
  }
  return <LeadContext.Provider value={{ drag, setDrag, moving, drop }}>{children}</LeadContext.Provider>;
}

export function StageColumn({ stage, className, children }: { stage: string; className: string; children: ReactNode }) {
  const ctx = useContext(LeadContext);
  const [over, setOver] = useState(false);
  const canDrop = !!ctx?.drag && ctx.drag.stage !== stage;
  return (
    <section
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
        ctx?.drop(stage);
      }}
      className={`${className} ${over && canDrop ? "ring-2 ring-fp-pink" : ""}`}
    >
      {children}
    </section>
  );
}

export function LeadCard({ id, stage, canDrag, children }: { id: string; stage: string; canDrag: boolean; children: ReactNode }) {
  const ctx = useContext(LeadContext);
  const busy = ctx?.moving === id || ctx?.drag?.id === id;
  return (
    <div
      draggable={canDrag && ctx?.moving !== id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        ctx?.setDrag({ id, stage });
      }}
      onDragEnd={() => ctx?.setDrag(null)}
      className={`${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}
