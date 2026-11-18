"use client";

import { useEffect } from "react";

// Inside a website's frame: tell the page how tall the form is (so the frame
// grows to fit, see embedCode), and note which page it's on.
export default function FitFrame({ publicId }: { publicId: string }) {
  useEffect(() => {
    const page = document.querySelector<HTMLInputElement>('input[name="page"]');
    if (page && document.referrer) page.value = document.referrer.slice(0, 300);
    if (window.parent === window) return;
    const send = () => window.parent.postMessage({ fposForm: publicId, height: document.documentElement.scrollHeight }, "*");
    send();
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [publicId]);
  return null;
}
