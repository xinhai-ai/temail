import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Set Variable",
  summary: "在工作流上下文中写入一个变量，供后续节点引用。",
  fields: [
    {
      key: "name",
      label: "Variable Name",
      description: "变量名（建议使用小写字母/下划线）。",
      required: true,
      example: "order_id",
    },
    {
      key: "value",
      label: "Value",
      description: "变量值。可使用模板变量引用邮件字段或已有变量。",
      required: true,
      example: "{{email.subject}}",
    },
  ],
  notes: [
    "后续可通过 {{variables.yourVar}} 读取该变量。",
  ],
};

export default manual;

