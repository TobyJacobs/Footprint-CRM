"use client";

import { useState } from "react";
import { inputClass, primaryButton } from "@/components/ui";

type Project = { id: string; name: string };
type Task = { id: string; project_id: string; title: string };

// Log hours: pick a project (the task list follows it), the day, the hours.
export default function TimeForm({
  action,
  projects,
  tasks,
  defaultProjectId,
  defaultDate,
  back,
}: {
  action: (fd: FormData) => Promise<void>;
  projects: Project[];
  tasks: Task[];
  defaultProjectId?: string;
  defaultDate: string;
  back: string;
}) {
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const projectTasks = tasks.filter((t) => t.project_id === projectId);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr_1fr] sm:items-end">
      <input type="hidden" name="back" value={back} />
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Project</span>
        <select name="project_id" required value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Task (optional)</span>
        <select name="task_id" className={inputClass} disabled={projectTasks.length === 0}>
          <option value="">{projectTasks.length === 0 ? "No tasks" : "Whole project"}</option>
          {projectTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Day</span>
        <input name="work_date" type="date" required defaultValue={defaultDate} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-semibold">Hours</span>
        <input name="hours" type="number" step="0.25" min="0.25" max="24" required placeholder="1.5" className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm sm:col-span-3">
        <span className="font-semibold">Notes (optional)</span>
        <input name="notes" className={inputClass} placeholder="What did you do?" />
      </label>
      <div>
        <button type="submit" className={`${primaryButton} w-full`}>
          Log time
        </button>
      </div>
    </form>
  );
}
