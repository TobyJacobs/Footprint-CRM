"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export const MAX_FILES = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
const OK_TYPES = [
  "image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

type Uploaded = { path: string; name: string; size: number; type: string };

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// "Attach files or images" for a request. Files go straight to private
// storage as they're chosen; the form then just carries their names.
export default function AttachmentPicker({ userId }: { userId: string }) {
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const choose = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    const picked = Array.from(list);
    if (files.length + picked.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files.`);
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    const done: Uploaded[] = [];
    for (const f of picked) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is bigger than 10 MB.`);
        continue;
      }
      if (!OK_TYPES.includes(f.type)) {
        setError(`"${f.name}" isn't a type we accept (images, PDF, Word, Excel, PowerPoint, text).`);
        continue;
      }
      const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
      const path = `${userId}/${crypto.randomUUID()}-${safe}`;
      const { error: upError } = await supabase.storage.from("request-attachments").upload(path, f, { contentType: f.type });
      if (upError) setError(`"${f.name}" couldn't be uploaded: ${upError.message}`);
      else done.push({ path, name: f.name, size: f.size, type: f.type });
    }
    setFiles((old) => [...old, ...done]);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const remove = async (path: string) => {
    setFiles((old) => old.filter((x) => x.path !== path));
    // Best effort: tidy up the unsent file (only admins can delete, so it may stay).
    await createBrowserSupabase().storage.from("request-attachments").remove([path]).catch(() => undefined);
  };

  return (
    <div className="grid gap-2">
      <input type="hidden" name="attachments" value={JSON.stringify(files)} />
      <div>
        <span className="font-semibold">Attach files or images</span>
        <span className="ml-2 text-xs text-fp-mid">Up to {MAX_FILES}, 10 MB each</span>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed border-fp-mid px-3 py-2 text-sm font-semibold hover:border-fp-pink hover:text-fp-pink">
        <Paperclip size={15} aria-hidden />
        {busy ? "Uploading…" : "Choose files"}
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          disabled={busy || files.length >= MAX_FILES}
          onChange={(e) => choose(e.target.files)}
          className="sr-only"
        />
      </label>
      {error && <p className="text-xs text-fp-error">{error}</p>}
      {files.length > 0 && (
        <ul className="grid gap-1 text-xs">
          {files.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-2 rounded bg-fp-offwhite px-2 py-1">
              <span className="truncate">
                {f.name} <span className="text-fp-mid">({kb(f.size)})</span>
              </span>
              <button type="button" onClick={() => remove(f.path)} className="shrink-0 text-fp-mid hover:text-fp-error" aria-label={`Remove ${f.name}`}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="text-xs text-fp-mid">Please wait for the upload to finish before sending.</p>}
    </div>
  );
}
