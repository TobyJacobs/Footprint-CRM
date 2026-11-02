"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { recordPageFile } from "../../actions";

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

// Upload one page's finished file (PDF, JPG or PNG). If the flipbook is
// online, the new page shows there straight away.
export default function PageUploader({ issueId, page, replacing }: { issueId: string; page: number; replacing: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const finish = (message: string | null) => {
    setError(message);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  const upload = async (list: FileList | null) => {
    const f = list?.[0];
    if (!f) return;
    setError(null);
    const ext = TYPES[f.type];
    if (!ext) return finish("Use a PDF, JPG or PNG.");
    if (f.size > MAX_BYTES) return finish("Bigger than 20 MB. Export it smaller and try again.");
    setBusy(true);
    const path = `${issueId}/pages/${page}-${crypto.randomUUID()}.${ext}`;
    const supabase = createBrowserSupabase();
    const { error: upError } = await supabase.storage.from("flipbooks").upload(path, f, { contentType: f.type });
    if (upError) return finish(`Couldn't upload: ${upError.message}`);
    const result = await recordPageFile(issueId, page, path, f.type);
    if (!result.ok) {
      await supabase.storage.from("flipbooks").remove([path]).catch(() => undefined);
      return finish(result.error);
    }
    finish(null);
    router.refresh();
  };

  return (
    <div className="grid gap-0.5">
      <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-dashed border-fp-mid/40 bg-white px-1 py-1 text-[11px] font-semibold text-fp-teal-deep hover:border-fp-pink">
        <Upload size={12} aria-hidden />
        {busy ? "Uploading…" : replacing ? "Replace page" : "Upload page"}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy}
          onChange={(e) => upload(e.target.files)}
          aria-label={`Upload page ${page}`}
          className="sr-only"
        />
      </label>
      {error && (
        <p role="alert" className="text-[11px] leading-tight text-fp-error">
          {error}
        </p>
      )}
    </div>
  );
}
