// Team chat types shared by the server pages and the chat screen in the browser.

export type ChatAttachment = { path: string; name: string; size: number; type: string };

export type ChatMessage = {
  id: string;
  channel_id: string;
  author_id: string | null;
  body: string;
  attachments: ChatAttachment[];
  mentions: string[];
  created_at: string;
  edited_at: string | null;
};

export type ChatPerson = { id: string; name: string };

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_MESSAGE_LENGTH = 4000;
