import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Branch",
  summary: "根据条件将流程分支为“满足/不满足”两条路径。",
  fields: [
    {
      key: "condition.field",
      label: "Field",
      description: "选择要判断的邮件字段（如 Subject / From / Body 等）。",
      required: true,
      example: "subject",
    },
    {
      key: "condition.operator",
      label: "Operator",
      description: "选择匹配运算符（contains / equals / regex / isEmpty 等）。",
      required: true,
      example: "contains",
    },
    {
      key: "condition.value",
      label: "Value",
      description: "用于匹配的值；当 Operator 为 isEmpty/isNotEmpty 时可留空。",
      example: "invoice",
    },
    {
      key: "condition.caseSensitive",
      label: "Case Sensitive",
      description: "是否区分大小写（可选）。",
      example: "false",
    },
  ],
  notes: [
    "分支节点通常接在触发器之后，用于按规则走不同的后续动作/转发。",
  ],
};

export default manual;

