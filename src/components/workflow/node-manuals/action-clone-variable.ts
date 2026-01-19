import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Clone Variable",
  summary: "将一个变量的值复制到另一个变量名下。",
  fields: [
    {
      key: "source",
      label: "Source Variable",
      description: "要复制的源变量名。",
      required: true,
      example: "sourceVar",
    },
    {
      key: "target",
      label: "Target Variable",
      description: "目标变量名（若已存在会被覆盖）。",
      required: true,
      example: "targetVar",
    },
  ],
};

export default manual;

