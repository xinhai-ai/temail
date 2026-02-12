import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Send to ServerChan",
  summary: "通过 ServerChan v3 的 SendKey 接口推送邮件通知。",
  fields: [
    {
      key: "sendKey",
      label: "SendKey",
      description: "ServerChan API 密钥（来自 SendKey 页面）。",
      required: true,
      example: "SCTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    {
      key: "title",
      label: "Title Template",
      description: "消息标题模板，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "📧 {{email.subject}}",
    },
    {
      key: "desp",
      label: "Description Template",
      description: "消息正文模板，支持多行文本。",
      example: "From: {{email.fromAddress}}\\n\\n{{email.textBody}}",
    },
  ],
  notes: [
    "调用地址固定为 https://sctapi.ftqq.com/<SENDKEY>.send。",
    "标题和内容默认会回退到邮件主题与正文摘要。",
  ],
};

export default manual;
