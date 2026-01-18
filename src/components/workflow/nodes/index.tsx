"use client";

import { NodeTypes } from "reactflow";
import { BaseNode } from "./BaseNode";
import type { NodeType } from "@/lib/workflow/types";
import type { ComponentType } from "react";
import type { NodeProps } from "reactflow";

// 所有节点类型都使用 BaseNode 组件渲染
// 不同类型的节点通过 type 属性区分样式和行为
const createNodeComponent = (nodeType: NodeType): ComponentType<NodeProps> => {
  // eslint-disable-next-line react/display-name
  return (props: NodeProps) => {
    return <BaseNode {...props} type={nodeType} />;
  };
};

// 导出所有节点类型
export const nodeTypes: NodeTypes = {
  // 触发器
  "trigger:email": createNodeComponent("trigger:email"),
  "trigger:schedule": createNodeComponent("trigger:schedule"),
  "trigger:manual": createNodeComponent("trigger:manual"),

  // 条件判断
  "condition:match": createNodeComponent("condition:match"),
  "condition:keyword": createNodeComponent("condition:keyword"),
  "condition:ai-classifier": createNodeComponent("condition:ai-classifier"),
  "condition:classifier": createNodeComponent("condition:classifier"),
  "condition:custom": createNodeComponent("condition:custom"),

  // 执行动作
  "action:archive": createNodeComponent("action:archive"),
  "action:markRead": createNodeComponent("action:markRead"),
  "action:markUnread": createNodeComponent("action:markUnread"),
  "action:star": createNodeComponent("action:star"),
  "action:unstar": createNodeComponent("action:unstar"),
  "action:delete": createNodeComponent("action:delete"),
  "action:setVariable": createNodeComponent("action:setVariable"),
  "action:unsetVariable": createNodeComponent("action:unsetVariable"),
  "action:cloneVariable": createNodeComponent("action:cloneVariable"),
  "action:rewriteEmail": createNodeComponent("action:rewriteEmail"),
  "action:regexReplace": createNodeComponent("action:regexReplace"),
  "action:aiRewrite": createNodeComponent("action:aiRewrite"),

  // 转发
  "forward:email": createNodeComponent("forward:email"),
  "forward:telegram": createNodeComponent("forward:telegram"),
  "forward:discord": createNodeComponent("forward:discord"),
  "forward:slack": createNodeComponent("forward:slack"),
  "forward:webhook": createNodeComponent("forward:webhook"),

  // 流程控制
  "control:branch": createNodeComponent("control:branch"),
  "control:delay": createNodeComponent("control:delay"),
  "control:end": createNodeComponent("control:end"),
};

export { BaseNode };
