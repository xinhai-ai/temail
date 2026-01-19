import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Rewrite Email",
  summary: "使用模板重写邮件的 Subject/Text/HTML 内容（可选）。",
  fields: [
    {
      key: "subject",
      label: "Subject Template",
      description: "新的标题模板；留空则保持原标题。",
      example: "Re: {{email.subject}}",
    },
    {
      key: "textBody",
      label: "Text Body Template",
      description: "新的纯文本正文模板。",
      example: "{{email.textBody}}",
    },
    {
      key: "htmlBody",
      label: "HTML Body Template",
      description: "新的 HTML 正文模板。",
      example: "{{email.htmlBody}}",
    },
  ],
  notes: [
    "模板可引用 {{email.*}} 与 {{variables.*}}。",
    "重写内容会影响后续转发/输出节点的实际内容。",
  ],
};

export default manual;

