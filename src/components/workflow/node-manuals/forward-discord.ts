import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Forward Discord",
  summary: "将邮件通知发送到 Discord（Webhook）。",
  fields: [
    {
      key: "webhookUrl",
      label: "Webhook URL",
      description: "Discord Webhook 地址（Server Settings → Integrations → Webhooks）。",
      required: true,
      example: "https://discord.com/api/webhooks/...",
    },
    {
      key: "useEmbed",
      label: "Use Rich Embed",
      description: "是否使用富文本 Embed 展示（部分预设会自动开启）。",
      example: "false",
    },
    {
      key: "template",
      label: "Message Template",
      description: "消息模板，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "📧 New email notification",
    },
  ],
  notes: [
    "可在模板下拉中选择预设（default/compact/embed）。",
  ],
};

export default manual;

