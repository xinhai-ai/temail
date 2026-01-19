import type { NodeManual } from "./types";

const manual: NodeManual = {
  title: "Custom Condition",
  summary: "使用自定义适配器实现条件判断（adapterId + JSON 配置）。",
  fields: [
    {
      key: "adapterId",
      label: "Adapter ID",
      description: "选择/填写自定义适配器标识（由系统/插件提供）。",
      required: true,
      example: "my-adapter",
    },
    {
      key: "config",
      label: "Config",
      description: "适配器所需的 JSON 配置（字段由适配器定义）。",
      example: "{\n  \"enabled\": true\n}",
    },
  ],
  notes: [
    "当前 UI 可能未暴露完整的自定义配置入口；若你看不到对应表单，需要先实现/启用该适配器的配置 UI。",
  ],
};

export default manual;

