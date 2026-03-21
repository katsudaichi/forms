export type FieldType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "image"
  | "email"
  | "url";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  hint?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  maxLength?: number;
  maxCount?: number;
}

export interface PostSegment {
  id: string;
  type: "text" | "field";
  value: string;
}

export interface TextLayer {
  id: string;
  fieldId: string;
  x: number;
  y: number;
  w: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  bold: boolean;
  align: "left" | "center" | "right";
}

export interface CompositeTemplate {
  frameUrl: string | null;
  frameAspect: number;
  photoArea: {
    x: number;
    y: number;
    w: number;
    h: number;
    scale?: number;
  };
  textLayers: TextLayer[];
}

export interface CompositePattern {
  id: string;
  name: string;
  template: CompositeTemplate;
}

export interface CompositeConfig {
  activePatternId: string;
  patterns: CompositePattern[];
}

export interface ResponseImageTemplate {
  patternId: string;
  template?: CompositeTemplate;
}

export interface FormDefinition {
  id: string;
  tenantSlug: string;
  name: string;
  status: "open" | "closed";
  headerTitle: string;
  headerSubtitle: string;
  description: string;
  headerImageUrl: string | null;
  fieldConfig: FormField[];
  postTemplate: PostSegment[];
  compositeTemplate: CompositeConfig;
  colWidths: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseRecord {
  id: string;
  formId: string;
  data: Record<string, string | string[]>;
  images: string[];
  perImageTpls?: ResponseImageTemplate[];
  isDirty: boolean;
  submittedAt: string;
  updatedAt: string;
}

export interface Tenant {
  name: string;
  slug: string;
}

export interface AppState {
  tenant: Tenant;
  forms: FormDefinition[];
  responses: ResponseRecord[];
}

export interface DbFormRow {
  id: string;
  tenant_id: string;
  name: string;
  status: "open" | "closed";
  header_title: string;
  header_subtitle: string;
  description: string;
  header_image_url: string | null;
  field_config: FormField[];
  post_template: PostSegment[];
  composite_template: CompositeConfig | CompositeTemplate;
  col_widths: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export interface DbResponseRow {
  id: string;
  form_id: string;
  data: Record<string, string | string[]>;
  per_image_tpls?: ResponseImageTemplate[] | CompositeTemplate[] | null;
  is_dirty: boolean;
  submitted_at: string;
  updated_at: string;
}
