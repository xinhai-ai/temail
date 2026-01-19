import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Delete Email",
  summary: "删除当前邮件（通常移动到垃圾箱）。",
  notes: [
    "该节点没有额外配置。",
    "删除是高风险操作，建议先用条件节点严格过滤后再执行。",
  ],
};

export default manual;

