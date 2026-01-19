import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Schedule Trigger",
  summary: "按 Cron 计划周期性触发工作流，适合定时拉取/定时处理类任务。",
  fields: [
    {
      key: "cron",
      label: "Cron Expression",
      description: "Cron 表达式（必填）。例如：0 * * * * 表示每小时整点；0 9 * * * 表示每天 9 点。",
      required: true,
      example: "0 * * * *",
    },
    {
      key: "timezone",
      label: "Timezone",
      description: "时区（可选），用于解释 Cron 的时间。留空则使用默认时区（通常为 UTC）。",
      example: "UTC / Asia/Shanghai",
    },
  ],
  notes: [
    "Cron 触发不会读取邮件上下文；如需处理邮件请搭配其他节点/数据源。",
  ],
};

export default manual;

