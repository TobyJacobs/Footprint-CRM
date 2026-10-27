"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { recordFlipbook } from "../../actions";

const MAX_BYTES = 50 * 1024 * 1024;

// Upload the issue's finished PDF; it becomes the public flipbook straight away.
export default function FlipbookUploader({ issueId, replacing }: { issueId: string; replacing: boolean }) {
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
    if (f.type !== "application/pdf") return finish(`"${f.name}" isn't a PDF.`);
    if (f.size > MAX_BYTES) return finish(`"${f.name}" is bigger than 50 MB. Export a smaller PDF (e.g. InDesign's "Smallest File Size") and try again.`);
    setBusy(true);
    const path = `${issueId}/${crypto.randomUUID()}.pdf`;
    const supabase = createBrowserSupabase();
    const { error: upError } = await supabase.storage.from("flipbooks").upload(path, f, { contentType: "application/pdf" });
    if (upError) return finish(`The PDF couldn't be uploaded: ${upError.message}`);
    const result = await recordFlipbook(issueId, path);
    if (!result.ok) {
      await supabase.storage.from("flipbooks").remove([path]).catch(() => undefined);
      return finish(result.error);
    }
    finish(null);
    router.refresh();
  };

  return (
    <div className="grid gap-2 text-sm">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md bg-fp-pink px-4 py-2 font-semibold text-white hover:bg-fp-pink/90">
        <Upload size={15} aria-hidden />
        {busy ? "Uploading…" : replacing ? "Replace the PDF" : "Upload the issue PDF"}
        <input ref={input} type="file" accept="application/pdf" disabled={busy} onChange={(e) => upload(e.target.files)} className="sr-only" />
      </label>
      <p className="text-xs text-fp-mid">The finished magazine as one PDF, up to 50 MB. It goes online as soon as it&apos;s uploaded.</p>
      {error && (
        <p role="alert" className="text-xs text-fp-error">
          {error}
        </p>
      )}
    </div>
  );
}
