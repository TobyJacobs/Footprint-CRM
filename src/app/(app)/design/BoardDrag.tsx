"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { setJobStage } from "./actions";

// Drag a job card onto another column to change its stage. Uses the browser's
// own drag and drop, so it works with a mouse; on phones and tablets the
// "Move to …" button on each card does the same job.
type Drag = { jobId: string; stage: string } | null;

const BoardContext = createContext<{
  drag: Drag;
  setDrag: (d: Drag) => void;
  moving: Drag;
  move: (stage: string) => void;
} | null>(null);

export function BoardDrag({ back, children }: { back: string; children: ReactNode }) {
  const [drag, setDrag] = useState<Drag>(null);
  // The card being saved, greyed out until the board reloads with it in its
  // new column (the action redirects, so nothing runs after it succeeds).
  const [moving, setMoving] = useState<Drag>(null);
  const [, startTransition] = useTransition();

  function move(stage: string) {
    if (!drag || drag.stage === stage) return;
    const fd = new FormData();
    fd.set("stage", stage);
    fd.set("back", back);
    const { jobId } = drag;
    setMoving(drag);
    setDrag(null);
    // The action saves the new stage and reloads the board.
    startTransition(() => setJobStage(jobId, fd));
  }

  return <BoardContext.Provider value={{ drag, setDrag, moving, move }}>{children}</BoardContext.Provider>;
}

export function DropColumn({ stage, label, children }: { stage: string; label: string; children: ReactNode }) {
  const board = useContext(BoardContext);
  const [over, setOver] = useState(false);
  const canDrop = !!board?.drag && board.drag.stage !== stage;
  return (
    <section
      aria-label={label}
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
        board?.move(stage);
      }}
      className={`flex flex-col gap-2 rounded-lg p-2 transition-colors ${
        over && canDrop ? "bg-fp-pink/10 ring-2 ring-fp-pink/40" : "bg-fp-offwhite"
      }`}
    >
      {children}
    </section>
  );
}

export function DragCard({
  jobId,
  stage,
  canDrag,
  className,
  children,
}: {
  jobId: string;
  stage: string;
  canDrag: boolean;
  className: string;
  children: ReactNode;
}) {
  const board = useContext(BoardContext);
  const moving = board?.moving?.jobId === jobId && board.moving.stage === stage;
  const dragging = board?.drag?.jobId === jobId;
  return (
    <article
      draggable={canDrag && !moving}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", jobId);
        board?.setDrag({ jobId, stage });
      }}
      onDragEnd={() => board?.setDrag(null)}
      aria-busy={moving || undefined}
      className={`${className} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${
        dragging || moving ? "opacity-50" : ""
      }`}
    >
      {children}
    </article>
  );
}
