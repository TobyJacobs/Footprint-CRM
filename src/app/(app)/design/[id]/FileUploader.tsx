"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { inputClass } from "@/components/ui";
import { DESIGN_BUCKET, DESIGN_FILE_MAX_BYTES, DESIGN_FILE_TYPES } from "@/lib/design/options";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { recordFile } from "../actions";

// Add a proof (numbered v1, v2…) or a brief file to a job. The file goes
// straight to private storage, then is recorded against the job.
export default function FileUploader({ jobId, canAddProof }: { jobId: string; canAddProof: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<"proof" | "brief">(canAddProof ? "proof" : "brief");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setError(null);
    if (f.size > DESIGN_FILE_MAX_BYTES) return finish(`"${f.name}" is bigger than 25 MB.`);
    if (!DESIGN_FILE_TYPES.includes(f.type)) return finish(`"${f.name}" isn't an image (PNG, JPG, GIF, WebP) or a PDF.`);
    setBusy(true);
    const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
    const path = `${jobId}/${crypto.randomUUID()}-${safe}`;
    const supabase = createBrowserSupabase();
    const { error: upError } = await supabase.storage.from(DESIGN_BUCKET).upload(path, f, { contentType: f.type });
    if (upError) return finish(`"${f.name}" couldn't be uploaded: ${upError.message}`);
    const result = await recordFile(jobId, { path, name: f.name, size: f.size, type: f.type, kind, note: note.trim() || null });
    if (!result.ok) {
      // Don't leave an unrecorded file behind (best effort: only designers can delete).
      await supabase.storage.from(DESIGN_BUCKET).remove([path]).catch(() => undefined);
      return finish(result.error);
    }
    setNote("");
    finish(null);
    router.refresh();
  };

  const finish = (message: string | null) => {
    setError(message);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div className="grid gap-3 rounded-md border border-dashed border-fp-mid/50 p-4 text-sm">
      <div className="flex flex-wrap gap-4">
        {canAddProof && (
          <label className="flex items-center gap-2">
            <input type="radio" name="kind" checked={kind === "proof"} onChange={() => setKind("proof")} className="accent-fp-pink" />
            New proof version
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="radio" name="kind" checked={kind === "brief"} onChange={() => setKind("brief")} className="accent-fp-pink" />
          Brief file (logo, photo, reference)
        </label>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder={kind === "proof" ? "What changed in this version? (optional)" : "What is this file? (optional)"}
        className={inputClass}
      />
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-fp-pink px-4 py-2 font-semibold text-white hover:bg-fp-pink/90">
        <Upload size={15} aria-hidden />
        {busy ? "Uploading…" : "Choose a file"}
        <input
          ref={input}
          type="file"
          accept={DESIGN_FILE_TYPES.join(",")}
          disabled={busy}
          onChange={(e) => upload(e.target.files)}
          className="sr-only"
        />
      </label>
      <p className="text-xs text-fp-mid">Images (PNG, JPG, GIF, WebP) or PDF, up to 25 MB.</p>
      {error && (
        <p role="alert" className="text-xs text-fp-error">
          {error}
        </p>
      )}
    </div>
  );
}
