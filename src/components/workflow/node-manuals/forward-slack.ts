import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Forward Slack",
  summary: "将邮件通知发送到 Slack（Incoming Webhook）。",
  fields: [
    {
      key: "webhookUrl",
      label: "Webhook URL",
      description: "Slack Incoming Webhook 地址（Apps → Incoming Webhooks）。",
      required: true,
      example: "https://hooks.slack.com/services/...",
    },
    {
      key: "useBlocks",
      label: "Use Block Kit",
      description: "是否使用 Block Kit 结构化消息（blocks 预设会自动开启）。",
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
    "可在模板下拉中选择预设（default/compact/blocks）。",
  ],
};

export default manual;

