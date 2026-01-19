import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Unset Variable",
  summary: "从工作流上下文中删除一个变量。",
  fields: [
    {
      key: "name",
      label: "Variable Name",
      description: "要删除的变量名。",
      required: true,
      example: "order_id",
    },
  ],
  notes: [
    "删除后，后续节点引用该变量可能为空/未定义。",
  ],
};

export default manual;

