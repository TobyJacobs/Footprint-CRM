// A template (unlike a layout) is re-created on every navigation, so wrapping
// pages in it lets each one fade and slide in softly (see globals.css).
export default function PageTransition({ children }: { children: React.ReactNode }) {
  return <div className="fp-page-enter">{children}</div>;
}
