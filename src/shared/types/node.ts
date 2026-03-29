// Trace: BD-03-004001, BD-03-004002, BD-03-004003

/**
 * ノード型定義・メタデータ
 */

// Trace: BD-03-004002
export interface PortDefinition {
  id: string;
  label: string;
  dataType: string; // "string" | "number" | "any" など
}

// Trace: BD-03-004003
export type FieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "keyValue";

// Trace: BD-03-004003
export interface SelectOption {
  value: string;
  label: string;
}

// Trace: BD-03-004003
export interface SettingFieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  defaultValue?: unknown;
  options?: SelectOption[];
  placeholder?: string;
  description?: string;
  visibleWhen?: { field: string; value: string | string[] };
}

// Trace: BD-03-004001
export interface INodeTypeMetadata {
  nodeType: string;
  label: string;
  icon: string;
  category: string;
  inputPorts: PortDefinition[];
  outputPorts: PortDefinition[];
  settingsSchema: SettingFieldDef[];
}
