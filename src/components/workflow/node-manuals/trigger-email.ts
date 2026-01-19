import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Email Trigger",
  summary: "当新邮件到达时触发工作流。你可以选择监听所有邮箱或指定某个邮箱。",
  fields: [
    {
      key: "mailboxId",
      label: "Mailbox Filter",
      description: "选择要监听的邮箱；选择 All Mailboxes 表示不限制邮箱。",
      example: "All Mailboxes / 选择具体邮箱地址",
    },
  ],
  notes: [
    "该触发器只负责“开始”工作流，后续过滤建议用条件节点完成。",
  ],
};

export default manual;

