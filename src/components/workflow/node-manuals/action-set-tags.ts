import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Set Tags",
  summary: "为邮件添加/移除/设置标签（Tags）。",
  fields: [
    {
      key: "mode",
      label: "Mode",
      description: "add：添加；remove：移除；set：用给定列表覆盖现有标签。",
      required: true,
      example: "add",
    },
    {
      key: "tags",
      label: "Tags",
      description: "标签列表（每行一个）。支持模板变量。",
      required: true,
      example: "urgent\nbilling",
    },
  ],
};

export default manual;

