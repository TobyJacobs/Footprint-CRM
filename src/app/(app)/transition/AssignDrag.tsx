"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { reassignAction } from "./actions";

// Drag an action onto a person to make them its owner (This week). Same
// browser drag and drop as the Design board and flatplans; on a phone, change
// the owner in the action's side panel instead.
type Drag = { id: string; owner: string | null } | null;

const AssignContext = createContext<{
  drag: Drag;
  setDrag: (d: Drag) => void;
  moving: string | null;
  drop: (owner: string | null) => void;
} | null>(null);

export function AssignDrag({ back, people, children }: { back: string; people: { id: string; name: string }[]; children: ReactNode }) {
  const [drag, setDrag] = useState<Drag>(null);
  // The action being saved, greyed out until the page reloads with it moved.
  const [moving, setMoving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function drop(owner: string | null) {
    if (!drag || drag.owner === owner) return;
    const { id } = drag;
    setMoving(id);
    setDrag(null);
    startTransition(() => reassignAction(id, owner, back));
  }

  return (
    <AssignContext.Provider value={{ drag, setDrag, moving, drop }}>
      {drag && (
        <div className="sticky top-2 z-30 rounded-lg border border-fp-pink/40 bg-white/95 p-2 shadow-lg backdrop-blur" role="region" aria-label="Drop on a person">
          <p className="mb-1.5 px-1 text-xs font-semibold text-fp-dark/75">Drop on a person to make them the owner:</p>
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <DropPerson key={p.id} owner={p.id} className="rounded-full border border-fp-border bg-white px-3 py-1 text-xs font-semibold">
                {p.name}
              </DropPerson>
            ))}
            <DropPerson owner={null} className="rounded-full border border-dashed border-fp-border bg-white px-3 py-1 text-xs font-semibold text-fp-mid">
              No owner
            </DropPerson>
          </div>
        </div>
      )}
      {children}
    </AssignContext.Provider>
  );
}

// Anything an action can be dropped on: a person's group or their chip.
export function DropPerson({ owner, className, children }: { owner: string | null; className: string; children: ReactNode }) {
  const ctx = useContext(AssignContext);
  const [over, setOver] = useState(false);
  const canDrop = !!ctx?.drag && ctx.drag.owner !== owner;
  return (
    <div
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
        ctx?.drop(owner);
      }}
      className={`${className} transition-shadow ${over && canDrop ? "ring-2 ring-fp-pink" : ""}`}
    >
      {children}
    </div>
  );
}

export function DragAction({ id, owner, canDrag, children }: { id: string; owner: string | null; canDrag: boolean; children: ReactNode }) {
  const ctx = useContext(AssignContext);
  const busy = ctx?.moving === id || ctx?.drag?.id === id;
  return (
    <li
      draggable={canDrag && ctx?.moving !== id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        ctx?.setDrag({ id, owner });
      }}
      onDragEnd={() => ctx?.setDrag(null)}
      aria-busy={ctx?.moving === id || undefined}
      className={`relative ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${busy ? "opacity-50" : ""}`}
    >
      {children}
    </li>
  );
}
