import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Forward Telegram",
  summary: "将邮件通知发送到 Telegram（通过 Bot Token + Chat ID）。",
  fields: [
    {
      key: "token",
      label: "Bot Token",
      description: "Telegram 机器人 Token（从 @BotFather 获取）。",
      required: true,
      example: "123456:ABC-DEF...",
    },
    {
      key: "chatId",
      label: "Chat ID",
      description: "接收消息的 Chat ID（可用 @userinfobot 获取）。",
      required: true,
      example: "-100123456789",
    },
    {
      key: "parseMode",
      label: "Parse Mode",
      description: "消息解析模式：None（请求中不传 parse_mode）/ Markdown / MarkdownV2 / HTML。",
      example: "Markdown",
    },
    {
      key: "template",
      label: "Message Template",
      description: "消息模板内容，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "📧 New email from {{email.fromAddress}}",
    },
  ],
  notes: [
    "可在模板下拉中选择预设（default/compact/detailed）。",
  ],
};

export default manual;
