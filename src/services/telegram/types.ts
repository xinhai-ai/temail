export type TelegramUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel" | (string & {});
  title?: string;
  username?: string;
  is_forum?: boolean;
};

export type TelegramMessageEntity = {
  type: string;
  offset: number;
  length: number;
};

export type TelegramMessage = {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  entities?: TelegramMessageEntity[];
  message_thread_id?: number;
  is_topic_message?: boolean;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: unknown;
};

