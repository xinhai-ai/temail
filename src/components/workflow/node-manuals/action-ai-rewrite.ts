import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "AI Rewrite",
  summary: "调用 AI 执行提取/改写，将结果写回变量或邮件内容。",
  fields: [
    {
      key: "writeTarget",
      label: "Write Target",
      description: "写入目标：variables / email / both。",
      required: true,
      example: "variables",
    },
    {
      key: "fields",
      label: "Prompt Fields",
      description: "选择发送给 AI 的邮件字段（Subject/Text/HTML）。",
      example: "subject, textBody",
    },
    {
      key: "prompt",
      label: "Instruction",
      description: "给 AI 的指令，说明要提取哪些字段、如何改写等。",
      required: true,
      example: "Extract order_id into variables, then rewrite subject.",
    },
    {
      key: "outputVariableKeys",
      label: "Output Variable Keys (optional)",
      description: "限制 AI 只能输出这些变量 key（逗号/换行分隔）。",
      example: "code, order_id",
    },
    {
      key: "resultVariable",
      label: "Result Variable (optional)",
      description: "将完整 JSON 结果保存到该变量名下。",
      example: "aiResult",
    },
  ],
  notes: [
    "Write Target 选择 email 时，会直接改写邮件内容；请谨慎使用。",
    "如需稳定结构化输出，建议指定 Output Variable Keys。",
  ],
};

export default manual;

