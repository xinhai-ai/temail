import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Forward Webhook",
  summary: "向外部 HTTP Endpoint 发送请求，将邮件数据以自定义格式推送到你的系统。",
  fields: [
    {
      key: "url",
      label: "Webhook URL",
      description: "目标请求地址。",
      required: true,
      example: "https://api.example.com/webhook",
    },
    {
      key: "method",
      label: "Method",
      description: "请求方法（GET/POST/PUT/PATCH/DELETE）。",
      example: "POST",
    },
    {
      key: "contentType",
      label: "Content-Type",
      description: "请求体类型：JSON / Form / Plain Text。",
      example: "application/json",
    },
    {
      key: "headers",
      label: "Custom Headers",
      description: "自定义请求头（如 Authorization）。",
      example: "Authorization: Bearer <token>",
    },
    {
      key: "bodyTemplate",
      label: "Body Template",
      description: "请求体模板，可使用 {{email.*}} 与 {{variables.*}}。",
      example: "{\n  \"subject\": \"{{email.subject}}\",\n  \"from\": \"{{email.fromAddress}}\"\n}",
    },
  ],
  notes: [
    "可在模板下拉中选择预设（json/minimal/full）。",
    "如使用 JSON，请确保模板最终是合法 JSON 字符串。",
  ],
};

export default manual;

