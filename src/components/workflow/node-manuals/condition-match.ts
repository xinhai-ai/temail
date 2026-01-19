import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Match Condition",
  summary: "对邮件字段进行匹配判断（包含/等于/正则等），用于分支或过滤。",
  fields: [
    {
      key: "field",
      label: "Field",
      description: "选择要匹配的邮件字段（如 Subject / From / Body 等）。",
      required: true,
      example: "subject",
    },
    {
      key: "operator",
      label: "Operator",
      description: "选择匹配运算符（contains / equals / regex / isEmpty 等）。",
      required: true,
      example: "contains",
    },
    {
      key: "value",
      label: "Value",
      description: "用于匹配的值；当 Operator 为 isEmpty/isNotEmpty 时可留空。",
      example: "invoice",
    },
    {
      key: "caseSensitive",
      label: "Case Sensitive",
      description: "是否区分大小写（可选）。",
      example: "false",
    },
  ],
  notes: [
    "当 Operator 为 regex 时，Value 应填写 JavaScript 正则表达式内容（不包含两侧 /）。",
  ],
};

export default manual;

