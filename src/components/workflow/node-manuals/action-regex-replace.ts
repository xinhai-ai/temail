import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Regex Replace",
  summary: "对邮件字段执行正则替换，支持捕获组与模板变量。",
  fields: [
    {
      key: "field",
      label: "Field",
      description: "要替换的字段（Subject / Body Text / Body HTML）。",
      required: true,
      example: "textBody",
    },
    {
      key: "pattern",
      label: "Pattern",
      description: "JavaScript 正则表达式内容（不包含两侧 /）。",
      required: true,
      example: "\\\\bfoo\\\\b",
    },
    {
      key: "flags",
      label: "Flags",
      description: "正则标志位（g/i/m/s/u/y），默认 g。",
      example: "gim",
    },
    {
      key: "replacement",
      label: "Replacement",
      description: "替换文本。支持 $1 捕获组与模板变量。",
      example: "Order: $1",
    },
  ],
  notes: [
    "建议先在小范围条件下验证正则，避免误替换大量内容。",
  ],
};

export default manual;

