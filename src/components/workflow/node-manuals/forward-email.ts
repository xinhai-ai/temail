import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Forward Email",
  summary: "将当前邮件内容转发到指定的收件邮箱，并可自定义转发标题与正文模板。",
  fields: [
    {
      key: "to",
      label: "Recipient Email",
      description: "转发目标邮箱地址。",
      required: true,
      example: "recipient@example.com",
    },
    {
      key: "template.subject",
      label: "Subject",
      description: "转发邮件标题模板，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "[Forwarded] {{email.subject}}",
    },
    {
      key: "template.body",
      label: "Body Template",
      description: "转发邮件正文模板（纯文本），可使用变量。",
      example: "{{email.textBody}}",
    },
  ],
  notes: [
    "可点击 Default 按钮填充默认模板。",
  ],
};

export default manual;

