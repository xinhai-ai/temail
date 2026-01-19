import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "End",
  summary: "显式结束当前分支的执行，后续节点不会再运行。",
  notes: [
    "该节点没有额外配置。",
    "常用于在分支中提前终止流程。",
  ],
};

export default manual;

