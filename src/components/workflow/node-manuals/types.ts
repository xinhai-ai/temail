export interface NodeManualField {
  key: string;
  label: string;
  description: string;
  required?: boolean;
  example?: string;
}

export interface NodeManualExample {
  title: string;
  example: string;
}

export interface NodeManualSection {
  title: string;
  description?: string;
  fields?: NodeManualField[];
  examples?: NodeManualExample[];
  notes?: string[];
}

export interface NodeManual {
  title: string;
  summary: string;
  fields?: NodeManualField[];
  examples?: NodeManualExample[];
  notes?: string[];
  sections?: NodeManualSection[];
}

