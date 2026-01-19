import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Delay",
  summary: "在继续执行后续节点前暂停指定时长（秒）。",
  fields: [
    {
      key: "duration",
      label: "Delay Duration (seconds)",
      description: "延迟时长（1–86400 秒）。",
      required: true,
      example: "60",
    },
  ],
  notes: [
    "长延迟会拖慢工作流完成时间；如需更复杂的调度建议使用 Schedule Trigger。",
  ],
};

export default manual;

