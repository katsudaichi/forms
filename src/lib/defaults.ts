import {
  CompositeTemplate,
  DbFormRow,
  FormField,
  PostSegment,
} from "@/lib/types";

export const defaultFields: FormField[] = [
  {
    id: "shopName",
    type: "text",
    label: "出店者名・店舗名",
    required: true,
    placeholder: "例：焼き菓子工房 さんぽ",
  },
  {
    id: "genre",
    type: "radio",
    label: "出品ジャンル",
    required: true,
    options: [
      "フード・飲食",
      "スイーツ・焼き菓子",
      "クラフト・雑貨",
      "アクセサリー",
      "ペット用品",
      "植物・花",
      "体験・ワークショップ",
      "その他",
    ],
  },
  {
    id: "items",
    type: "text",
    label: "出品品目",
    required: true,
    placeholder: "例：バターサンド、シュトーレン",
    hint: "扱う商品やサービスを具体的に（複数可）",
  },
  {
    id: "comment",
    type: "textarea",
    label: "PRコメント",
    required: true,
    maxLength: 200,
    hint: "200文字以内でアピールポイントを教えてください。",
  },
  {
    id: "instagram",
    type: "text",
    label: "Instagramアカウント",
    required: false,
    placeholder: "@your_account",
  },
  {
    id: "email",
    type: "email",
    label: "メールアドレス",
    required: true,
    placeholder: "example@mail.com",
  },
  {
    id: "images",
    type: "image",
    label: "PR画像",
    required: true,
    maxCount: 4,
    hint: "告知画像に使用します。最大4枚。",
  },
];

export const defaultPostTemplate: PostSegment[] = [
  { id: "text-1", type: "text", value: "【出店者紹介】\n" },
  { id: "field-1", type: "field", value: "shopName" },
  { id: "text-2", type: "text", value: "\n出品ジャンル： " },
  { id: "field-2", type: "field", value: "genre" },
  { id: "text-3", type: "text", value: "\n出品品目： " },
  { id: "field-3", type: "field", value: "items" },
  { id: "text-4", type: "text", value: "\nInstagram： " },
  { id: "field-4", type: "field", value: "instagram" },
  { id: "text-5", type: "text", value: "\n\n#わんにゃん道中膝栗毛 #出店者紹介" },
];

export const defaultCompositeTemplate: CompositeTemplate = {
  frameUrl: null,
  frameAspect: 1,
  photoArea: { x: 6, y: 6, w: 88, h: 62 },
  textLayers: [
    {
      id: "shop-layer",
      fieldId: "shopName",
      x: 6,
      y: 74,
      w: 88,
      fontSize: 15,
      fontFamily: "'Noto Sans JP', sans-serif",
      color: "#2f241c",
      bold: true,
      align: "left",
    },
    {
      id: "items-layer",
      fieldId: "items",
      x: 6,
      y: 85,
      w: 88,
      fontSize: 10,
      fontFamily: "'Noto Sans JP', sans-serif",
      color: "#715742",
      bold: false,
      align: "left",
    },
    {
      id: "ig-layer",
      fieldId: "instagram",
      x: 6,
      y: 92,
      w: 88,
      fontSize: 9,
      fontFamily: "'Noto Sans JP', sans-serif",
      color: "#8d7769",
      bold: false,
      align: "left",
    },
  ],
};

export function createStarterForm(tenantId: string): Omit<
  DbFormRow,
  "id" | "created_at" | "updated_at"
> {
  return {
    tenant_id: tenantId,
    name: "新しい出店フォーム",
    status: "open",
    header_title: "イベント出店フォーム",
    header_subtitle: "日程・会場情報をここに記載",
    description:
      "出店者向けの基本情報、告知文、画像素材を収集するためのフォームです。",
    header_image_url: null,
    field_config: defaultFields,
    post_template: defaultPostTemplate,
    composite_template: defaultCompositeTemplate,
    col_widths: {
      shopName: 180,
      genre: 140,
      items: 220,
      instagram: 160,
      post: 320,
    },
  };
}
