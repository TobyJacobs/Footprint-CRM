"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { bool, list, str } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Team chat: starting chats and managing members. Sending, editing and
// deleting messages happens straight from the chat screen; the database
// checks every step (see the team_chat migration).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (fd: FormData, name: string) => list(fd, name).filter((v) => UUID_RE.test(v));
function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export async function createChannel(fd: FormData) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_team_channel", {
    p_name: str(fd, "name") ?? "",
    p_topic: str(fd, "topic") ?? "",
    p_private: bool(fd, "private"),
    p_members: ids(fd, "members"),
  });
  if (error || typeof data !== "string") fail("/chat/new", error?.message ?? "Couldn't make the channel");
  revalidatePath("/chat", "layout");
  redirect(`/chat/${data}`);
}

export async function startDirectChat(fd: FormData) {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_direct_chat", { p_people: ids(fd, "people") });
  if (error || typeof data !== "string") fail("/chat/new", error?.message ?? "Couldn't start the chat");
  revalidatePath("/chat", "layout");
  redirect(`/chat/${data}`);
}

export async function joinChannel(channelId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("team_chat_members").insert({ channel_id: channelId, user_id: user.id });
  if (error && error.code !== "23505") fail(`/chat/${channelId}`, error.message);
  revalidatePath("/chat", "layout");
  redirect(`/chat/${channelId}`);
}

export async function leaveChannel(channelId: string) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("team_chat_members").delete().eq("channel_id", channelId).eq("user_id", user.id);
  if (error) fail(`/chat/${channelId}`, error.message);
  revalidatePath("/chat", "layout");
  redirect("/chat");
}

export async function addPeople(channelId: string, fd: FormData) {
  await getCurrentUser();
  const people = ids(fd, "people");
  if (!people.length) fail(`/chat/${channelId}?settings=1`, "Choose someone to add");
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_chat_members")
    .upsert(people.map((p) => ({ channel_id: channelId, user_id: p })), { onConflict: "channel_id,user_id", ignoreDuplicates: true });
  if (error) fail(`/chat/${channelId}?settings=1`, error.message.includes("row-level") ? "Only people in this chat can add others" : error.message);
  revalidatePath("/chat", "layout");
  redirect(`/chat/${channelId}?settings=1&saved=1`);
}

export async function saveChannel(channelId: string, fd: FormData) {
  await getCurrentUser();
  const name = str(fd, "name");
  if (!name) fail(`/chat/${channelId}?settings=1`, "Give the channel a name");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_chat_channels")
    .update({ name: name.slice(0, 60), topic: str(fd, "topic")?.slice(0, 300) ?? null, archived: bool(fd, "archived") })
    .eq("id", channelId)
    .select("id");
  if (error) fail(`/chat/${channelId}?settings=1`, error.code === "23505" ? "There's already a channel with that name" : error.message);
  if (!data?.length) fail(`/chat/${channelId}?settings=1`, "Only whoever made the channel, or an admin, can change it");
  revalidatePath("/chat", "layout");
  redirect(`/chat/${channelId}?settings=1&saved=1`);
}

// Remove files of deleted or expired messages from storage (up to 100 at a
// time). Runs quietly when someone opens Team chat.
export async function tidyChatFiles() {
  await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_chat_files_to_remove");
  const paths = (data ?? []) as string[];
  if (!paths.length) return;
  const { error } = await supabase.storage.from("team-chat").remove(paths);
  if (error) {
    console.error("Team chat file tidy-up:", error.message);
    return;
  }
  await supabase.rpc("team_chat_files_removed", { p_paths: paths });
}
