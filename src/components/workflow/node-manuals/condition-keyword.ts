import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Keyword Match",
  summary: "根据关键词匹配邮件内容。支持布尔模式（命中/未命中）与多类别模式（命中后输出分类）。",
  sections: [
    {
      title: "Boolean Mode",
      description: "适合“满足/不满足”的单一判断场景。",
      fields: [
        {
          key: "keywords",
          label: "Keywords",
          description: "关键词列表。命中规则由 Match Type 决定。",
          example: "urgent\nbilling\nrefund",
        },
        {
          key: "matchType",
          label: "Match Type",
          description: "any 表示命中任意关键词即可；all 表示需要命中所有关键词。",
          example: "any",
        },
        {
          key: "fields",
          label: "Fields",
          description: "选择在哪些邮件字段中搜索关键词（如 Subject / Body）。",
          example: "subject, textBody",
        },
        {
          key: "caseSensitive",
          label: "Case Sensitive",
          description: "是否区分大小写（可选）。",
          example: "false",
        },
        {
          key: "conditions",
          label: "Advanced Conditions (optional)",
          description: "高级模式下可用 AND/OR/NOT 组合多个条件（会打开条件编辑模态框）。",
        },
      ],
    },
    {
      title: "Multi-category Mode",
      description: "适合“根据命中的关键词集合输出分类”的场景（多分支）。",
      fields: [
        {
          key: "categories",
          label: "Categories",
          description: "分类列表（如 work/personal/spam）。每个分类对应一组关键词规则。",
          example: "work\npersonal\nspam",
        },
        {
          key: "keywordSets",
          label: "Keyword Sets",
          description: "为每个分类配置关键词、匹配方式与字段范围。",
        },
        {
          key: "defaultCategory",
          label: "Default Category",
          description: "未命中任何分类时使用的默认分类。",
          example: "default",
        },
        {
          key: "fields",
          label: "Fields",
          description: "用于搜索关键词的字段集合（对所有分类生效）。",
          example: "subject, textBody",
        },
      ],
    },
  ],
  notes: [
    "如果你需要多个输出分支（每个分类一个分支），请使用 Multi-category Mode。",
  ],
};

export default manual;

