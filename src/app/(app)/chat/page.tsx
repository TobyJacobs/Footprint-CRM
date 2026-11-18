import { MessagesSquare } from "lucide-react";

// Desktop: nothing chosen yet. (On a phone this screen shows the list instead.)
export default function ChatHome() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-fp-mid lg:flex">
      <MessagesSquare size={32} aria-hidden className="text-fp-pink" />
      <p className="font-semibold text-fp-black">Choose a chat on the left</p>
      <p>or press + to start a channel or message someone.</p>
    </div>
  );
}
