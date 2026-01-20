import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Telegram Group (Bound)",
  summary: "无需配置：将邮件转发到你已绑定的 Telegram 话题群组，并自动路由到对应邮箱话题。",
  fields: [],
  notes: [
    "需要先在 Telegram 话题群组中执行 /bind 完成绑定。",
    "使用站点管理员配置的 Bot（telegram_bot_token）。",
    "默认会把邮件发送到对应邮箱的话题；若话题不存在会自动创建。",
  ],
};

export default manual;

