import type { NodeType } from "@/lib/workflow/types";
import type { NodeManual } from "./types";

export type NodeManualLoader = () => Promise<{ default: NodeManual }>;

export const nodeManualLoaders: Partial<Record<NodeType, NodeManualLoader>> = {
  "trigger:email": () => import("./trigger-email"),
  "trigger:schedule": () => import("./trigger-schedule"),
  "trigger:manual": () => import("./trigger-manual"),

  "condition:match": () => import("./condition-match"),
  "condition:keyword": () => import("./condition-keyword"),
  "condition:ai-classifier": () => import("./condition-ai-classifier"),
  "condition:classifier": () => import("./condition-classifier"),
  "condition:custom": () => import("./condition-custom"),

  "action:archive": () => import("./action-archive"),
  "action:markRead": () => import("./action-mark-read"),
  "action:markUnread": () => import("./action-mark-unread"),
  "action:star": () => import("./action-star"),
  "action:unstar": () => import("./action-unstar"),
  "action:delete": () => import("./action-delete"),
  "action:setVariable": () => import("./action-set-variable"),
  "action:unsetVariable": () => import("./action-unset-variable"),
  "action:cloneVariable": () => import("./action-clone-variable"),
  "action:rewriteEmail": () => import("./action-rewrite-email"),
  "action:regexReplace": () => import("./action-regex-replace"),
  "action:setTags": () => import("./action-set-tags"),
  "action:aiRewrite": () => import("./action-ai-rewrite"),

  "forward:email": () => import("./forward-email"),
  "forward:telegram": () => import("./forward-telegram"),
  "forward:discord": () => import("./forward-discord"),
  "forward:slack": () => import("./forward-slack"),
  "forward:webhook": () => import("./forward-webhook"),
};

export async function loadNodeManual(type: NodeType): Promise<NodeManual | null> {
  const loader = nodeManualLoaders[type];
  if (!loader) return null;
  const loadedModule = await loader();
  return loadedModule.default;
}
