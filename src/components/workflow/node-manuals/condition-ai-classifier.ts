import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "AI Classifier",
  summary: "使用 AI 对邮件进行多分类。你需要先在 Admin Settings 配置模型与 API Key。",
  fields: [
    {
      key: "categories",
      label: "Categories",
      description: "可选分类列表。分类越清晰越容易得到稳定结果。",
      required: true,
      example: "work, personal, spam",
    },
    {
      key: "fields",
      label: "Fields to Analyze",
      description: "选择要送入 AI 的邮件字段（如 Subject / Body）。",
      example: "subject, textBody",
    },
    {
      key: "confidenceThreshold",
      label: "Confidence Threshold",
      description: "置信度阈值（0–1）。低于阈值的结果会回退到 Default Category。",
      example: "0.7",
    },
    {
      key: "defaultCategory",
      label: "Default Category",
      description: "无法可靠分类时使用的默认分类。",
      example: "default",
    },
    {
      key: "customPrompt",
      label: "Custom Prompt (optional)",
      description: "自定义提示词。留空则使用全局默认提示词（在后台设置）。",
      example: "Classify the email into one of: {{categories}}",
    },
  ],
  notes: [
    "建议分类名使用简短英文/标识符，避免过长句子。",
    "长正文可能会被截断；必要时减少 Fields 或简化提示词。",
  ],
};

export default manual;

