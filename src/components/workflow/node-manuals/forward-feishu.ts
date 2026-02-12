import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Send to Feishu",
  summary: "通过飞书自定义机器人 Webhook 向群聊发送邮件通知。",
  fields: [
    {
      key: "webhookUrl",
      label: "Webhook URL",
      description: "飞书群机器人地址。",
      required: true,
      example: "https://open.feishu.cn/open-apis/bot/v2/hook/xxxx",
    },
    {
      key: "template",
      label: "Message Template",
      description: "文本消息模板，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "📧 {{email.subject}}\\nFrom: {{email.fromAddress}}",
    },
  ],
  notes: [
    "消息类型使用 text。",
    "如果飞书机器人启用了额外安全策略（如签名），请在机器人侧同步配置。",
  ],
};

export default manual;
