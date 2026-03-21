"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ConfigNotice } from "@/components/shared/config-notice";
import { CompositePreview } from "@/components/shared/composite-preview";
import {
  createStarterForm,
  defaultCompositeTemplate,
  defaultPostTemplate,
} from "@/lib/defaults";
import { getPhotoScale, resolvePhotoArea } from "@/lib/composite";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  CompositeTemplate,
  DbFormRow,
  DbResponseRow,
  FormField,
  PostSegment,
  ResponseRecord,
} from "@/lib/types";

type FormRow = DbFormRow;
type BrowserSupabase = NonNullable<ReturnType<typeof createClient>>;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
};

type ResponseWithImages = ResponseRecord & {
  response_images?: Array<{ storage_path: string; position: number }>;
};

const FIELD_TYPE_OPTIONS: Array<{ value: FormField["type"]; label: string }> = [
  { value: "text", label: "テキスト" },
  { value: "textarea", label: "テキストエリア" },
  { value: "radio", label: "ラジオ" },
  { value: "checkbox", label: "チェックボックス" },
  { value: "image", label: "画像アップロード" },
  { value: "email", label: "メール" },
  { value: "url", label: "URL" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "'Noto Sans JP', sans-serif", label: "Noto Sans JP" },
  { value: "'Hiragino Sans', 'Yu Gothic', sans-serif", label: "Hiragino Sans" },
  { value: "'Yu Mincho', 'Hiragino Mincho ProN', serif", label: "游明朝" },
  { value: "'Noto Serif JP', serif", label: "Noto Serif JP" },
  { value: "Georgia, serif", label: "Georgia" },
];

const COMPOSITE_REFERENCE_WIDTH = 560;

function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) {
    return normalized;
  }

  return `tenant-${crypto.randomUUID().slice(0, 8)}`;
}

function renderPostText(segments: PostSegment[], data: ResponseRecord["data"]) {
  return segments
    .map((segment) => {
      if (segment.type === "text") return segment.value;
      const raw = data[segment.value];
      return Array.isArray(raw) ? raw.join(" / ") : raw ?? "";
    })
    .join("");
}

function postTemplateToEditorText(segments: PostSegment[]) {
  return segments
    .map((segment) => (segment.type === "text" ? segment.value : `{{${segment.value}}}`))
    .join("");
}

function editorTextToPostTemplate(value: string) {
  const segments: PostSegment[] = [];
  const tokenPattern = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        id: `seg-${crypto.randomUUID()}`,
        type: "text",
        value: value.slice(lastIndex, match.index),
      });
    }

    segments.push({
      id: `seg-${crypto.randomUUID()}`,
      type: "field",
      value: match[1].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    segments.push({
      id: `seg-${crypto.randomUUID()}`,
      type: "text",
      value: value.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    segments.push({
      id: `seg-${crypto.randomUUID()}`,
      type: "text",
      value: "",
    });
  }

  return segments;
}

function getImageAspect(file: File) {
  return new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const aspect = image.naturalWidth && image.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : 1;
      URL.revokeObjectURL(objectUrl);
      resolve(aspect);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("画像サイズを取得できませんでした。"));
    };

    image.src = objectUrl;
  });
}

function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = src;
  });
}

function getStoragePathFromPublicUrl(publicUrl: string | null | undefined, bucket: string) {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length).split("?")[0] ?? null;
}

function mapResponseRow(
  row: DbResponseRow & {
    response_images?: Array<{ storage_path: string; position: number }>;
  },
  supabase: BrowserSupabase,
): ResponseWithImages {
  return {
    id: row.id,
    formId: row.form_id,
    data: row.data,
    perImageTpls: row.per_image_tpls ?? undefined,
    isDirty: row.is_dirty,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    response_images: row.response_images ?? [],
    images:
      row.response_images?.map(
        ({ storage_path }) =>
          supabase.storage.from("response-images").getPublicUrl(storage_path).data.publicUrl,
      ) ?? [],
  };
}

function createSampleResponseData(fields: FormField[], index: number) {
  const presets = [
    {
      shopName: "焼き菓子工房 さんぽ",
      genre: "スイーツ・焼き菓子",
      items: "バターサンド、栗の焼き菓子、焼きプリン",
      comment: "中津川産の栗を使った焼き菓子を中心に販売します。",
      instagram: "@sanpo_cake",
      email: "sanpo@example.com",
      website: "https://example.com/sanpo",
    },
    {
      shopName: "クラフト工房 こもれび",
      genre: "クラフト・雑貨",
      items: "レザー首輪、布バッグ、真鍮タグ",
      comment: "やわらかな素材で仕立てたペット雑貨を持っていきます。",
      instagram: "@komorebi_pet",
      email: "komorebi@example.com",
      website: "https://example.com/komorebi",
    },
    {
      shopName: "山のハム工房 YAMA",
      genre: "フード・飲食",
      items: "猪ジャーキー、燻製セット、無添加ソーセージ",
      comment: "わんちゃんと一緒に楽しめる無添加フードを販売します。",
      instagram: "@yama_ham",
      email: "yama@example.com",
      website: "https://example.com/yama",
    },
  ][index % 3];

  return Object.fromEntries(
    fields
      .filter((field) => field.type !== "image")
      .map((field) => {
        if (field.type === "checkbox") {
          return [field.id, field.options?.slice(0, 2) ?? []];
        }
        if (field.id in presets) {
          return [field.id, presets[field.id as keyof typeof presets] ?? ""];
        }
        if (field.type === "email") return [field.id, `sample${index + 1}@example.com`];
        if (field.type === "url") return [field.id, "https://example.com"];
        if (field.type === "textarea") return [field.id, `${field.label} のサンプル回答です。`];
        if (field.type === "radio") return [field.id, field.options?.[0] ?? ""];
        return [field.id, `${field.label} ${index + 1}`];
      }),
  );
}

function createSampleImageSvg(responseId: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dbeafe"/>
      <stop offset="100%" stop-color="#bfdbfe"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" rx="48" fill="url(#bg)"/>
  <circle cx="930" cy="180" r="120" fill="#60a5fa" opacity="0.45"/>
  <circle cx="220" cy="740" r="160" fill="#93c5fd" opacity="0.35"/>
  <rect x="120" y="160" width="960" height="580" rx="40" fill="#ffffff" opacity="0.82"/>
  <text x="160" y="270" font-family="'Noto Sans JP', sans-serif" font-size="58" font-weight="700" fill="#1e3a8a">画像確認用 サンプル</text>
  <text x="160" y="360" font-family="'Noto Sans JP', sans-serif" font-size="32" fill="#334155">回答一覧の画像編集導線テスト用</text>
  <text x="160" y="430" font-family="'Noto Sans JP', sans-serif" font-size="28" fill="#475569">response: ${responseId}</text>
</svg>`;
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageAspect = image.naturalWidth / image.naturalHeight;
  const frameAspect = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let offsetX = x;
  let offsetY = y;

  if (imageAspect > frameAspect) {
    drawHeight = width / imageAspect;
    offsetY = y + (height - drawHeight) / 2;
  } else {
    drawWidth = height * imageAspect;
    offsetX = x + (width - drawWidth) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

export function AdminWorkspace({
  tenantSlug,
  formId,
  mode,
  initialUserEmail,
}: {
  tenantSlug?: string;
  formId?: string;
  mode?: "builder" | "answers" | "composer" | "posttext" | "home";
  initialUserEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [responses, setResponses] = useState<ResponseWithImages[]>([]);
  const [activeForm, setActiveForm] = useState<FormRow | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [newFormName, setNewFormName] = useState("新しい出店フォーム");
  const [openFormId, setOpenFormId] = useState<string | null>(formId ?? null);
  const [answerSearch, setAnswerSearch] = useState("");
  const [answerGenre, setAnswerGenre] = useState("all");
  const [builderDirty, setBuilderDirty] = useState(false);
  const [postTextDraft, setPostTextDraft] = useState("");
  const [postTextDirty, setPostTextDirty] = useState(false);
  const [selectedComposerLayerId, setSelectedComposerLayerId] = useState<string>("photo");
  const [imageEditorTarget, setImageEditorTarget] = useState<{
    responseId: string;
    imageIndex: number;
  } | null>(null);
  const [imageEditorSelectedLayerId, setImageEditorSelectedLayerId] = useState<string>("photo");
  const postTextEditorRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const memberships = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id);

      const tenantIds = memberships.data?.map((item) => item.tenant_id) ?? [];

      if (tenantIds.length === 0) {
        setLoading(false);
        return;
      }

      const tenantsResult = await supabase
        .from("tenants")
        .select("id,name,slug")
        .in("id", tenantIds)
        .order("created_at", { ascending: true });

      const tenantRows = (tenantsResult.data ?? []) as TenantRow[];
      setTenants(tenantRows);

      const activeTenant =
        tenantRows.find((tenant) => tenant.slug === tenantSlug) ?? tenantRows[0] ?? null;

      if (!activeTenant) {
        setLoading(false);
        return;
      }

      setTenantId(activeTenant.id);

      const formsResult = await supabase
        .from("forms")
        .select("*")
        .eq("tenant_id", activeTenant.id)
        .order("created_at", { ascending: true });

      const formRows = (formsResult.data ?? []) as FormRow[];
      setForms(formRows);

      const resolvedForm =
        formRows.find((form) => form.id === formId) ?? formRows[0] ?? null;
      setActiveForm(resolvedForm);
      setOpenFormId(resolvedForm?.id ?? formRows[0]?.id ?? null);
      setBuilderDirty(false);
      setPostTextDraft(resolvedForm ? postTemplateToEditorText(resolvedForm.post_template) : "");
      setPostTextDirty(false);
      setSelectedComposerLayerId("photo");

      const routeTenantSlug = activeTenant.slug || activeTenant.id;

      if (!formId && resolvedForm) {
        router.replace(`/admin/${routeTenantSlug}/${resolvedForm.id}/builder`);
      }

      if (resolvedForm) {
        const responseResult = await supabase
          .from("responses")
          .select("id,form_id,data,per_image_tpls,is_dirty,submitted_at,updated_at,response_images(storage_path,position)")
          .eq("form_id", resolvedForm.id)
          .order("submitted_at", { ascending: false });

        const mappedResponses = ((responseResult.data ?? []) as Array<
          DbResponseRow & {
            response_images?: Array<{ storage_path: string; position: number }>;
          }
        >).map((response) => mapResponseRow(response, supabase));
        setResponses(mappedResponses);
      } else {
        setResponses([]);
      }

      setLoading(false);
    }

    void load();
  }, [formId, mode, router, supabase, tenantSlug]);

  const selectedField = useMemo(
    () => activeForm?.field_config.find((field) => field.id === selectedFieldId) ?? null,
    [activeForm, selectedFieldId],
  );
  const responseGenreFieldId =
    activeForm?.field_config.find((field) => field.id === "genre")?.id ??
    activeForm?.field_config.find((field) => field.type === "radio")?.id ??
    null;

  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      const shopValue = Object.values(response.data)
        .filter((value) => typeof value === "string")
        .join(" ")
        .toLowerCase();
      const searchText = answerSearch.trim().toLowerCase();
      const matchesSearch = searchText ? shopValue.includes(searchText) : true;
      const genreValue = responseGenreFieldId
        ? String(response.data[responseGenreFieldId] ?? "")
        : "";
      const matchesGenre = answerGenre === "all" ? true : genreValue === answerGenre;
      return matchesSearch && matchesGenre;
    });
  }, [answerGenre, answerSearch, responseGenreFieldId, responses]);

  const genreOptions = useMemo(() => {
    if (!responseGenreFieldId) return [];
    return Array.from(
      new Set(
        responses
          .map((response) => String(response.data[responseGenreFieldId] ?? ""))
          .filter(Boolean),
      ),
    );
  }, [responseGenreFieldId, responses]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (!tenantName.trim()) return;

    setSaving(true);
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const nextTenantId = crypto.randomUUID();
    const nextFormId = crypto.randomUUID();
    const slug = slugify(tenantName);
    const tenantResult = await supabase
      .from("tenants")
      .insert({ id: nextTenantId, name: tenantName.trim(), slug });

    if (tenantResult.error) {
      setMessage(tenantResult.error?.message ?? "テナント作成に失敗しました。");
      setSaving(false);
      return;
    }

    await supabase.from("tenant_members").insert({
      tenant_id: nextTenantId,
      user_id: user.id,
      role: "owner",
    });

    const starter = { id: nextFormId, ...createStarterForm(nextTenantId) };
    const formResult = await supabase.from("forms").insert(starter);

    setSaving(false);

    if (formResult.error) {
      setMessage(formResult.error?.message ?? "初期フォーム作成に失敗しました。");
      return;
    }

    router.push(`/admin/${slug}/${nextFormId}/builder`);
    router.refresh();
  }

  async function createForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (!tenantId || !newFormName.trim()) return;

    setSaving(true);
    const payload = {
      ...createStarterForm(tenantId),
      name: newFormName.trim(),
    };
    const result = await supabase.from("forms").insert(payload).select("id").single();
    setSaving(false);

    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "フォームの作成に失敗しました。");
      return;
    }

    const targetTenant = tenants.find((tenant) => tenant.id === tenantId);
    if (targetTenant) {
      router.push(`/admin/${targetTenant.slug || targetTenant.id}/${result.data.id}/builder`);
      router.refresh();
    }
  }

  async function deleteForm(targetForm: FormRow) {
    if (!supabase) return;

    const confirmed = window.confirm(`「${targetForm.name}」を削除します。回答一覧も削除されます。`);
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);

    const result = await supabase.from("forms").delete().eq("id", targetForm.id);

    setSaving(false);

    if (result.error) {
      setMessage(result.error.message ?? "フォーム削除に失敗しました。");
      return;
    }

    const nextForms = forms.filter((form) => form.id !== targetForm.id);
    setForms(nextForms);
    setOpenFormId((current) => (current === targetForm.id ? null : current));

    if (activeForm?.id === targetForm.id) {
      const nextForm = nextForms[0] ?? null;
      setActiveForm(nextForm);
      setResponses([]);
      setSelectedFieldId(null);
      setBuilderDirty(false);
      setSelectedComposerLayerId("photo");

      if (nextForm) {
        router.push(`/admin/${routeTenantSlug}/${nextForm.id}/builder`);
      } else {
        router.push("/admin");
      }
    }

    setMessage("フォームを削除しました。");
  }

  async function patchForm(patch: Partial<FormRow>) {
    if (!supabase) return;
    if (!activeForm) return;
    setSaving(true);

    const result = await supabase
      .from("forms")
      .update(patch)
      .eq("id", activeForm.id)
      .select("*")
      .single();

    setSaving(false);

    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "フォーム更新に失敗しました。");
      return;
    }

    setActiveForm(result.data as FormRow);
    setForms((current) =>
      current.map((form) => (form.id === result.data.id ? (result.data as FormRow) : form)),
    );
    setBuilderDirty(false);
    setMessage("保存しました。");
  }

  function buildBuilderPatch(form: FormRow, patch: Partial<FormRow> = {}) {
    return {
      header_title: form.header_title,
      header_subtitle: form.header_subtitle,
      description: form.description,
      field_config: form.field_config,
      ...patch,
    };
  }

  async function uploadAsset(
    event: ChangeEvent<HTMLInputElement>,
    assetType: "header" | "frame",
  ) {
    if (!supabase) return;
    if (!activeForm) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setSaving(true);
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
    const filePath = `${activeForm.id}/${assetType}.${extension}`;
    const currentAssetUrl =
      assetType === "header"
        ? activeForm.header_image_url
        : activeForm.composite_template?.frameUrl;
    const previousPath = getStoragePathFromPublicUrl(currentAssetUrl, "form-assets");

    if (previousPath && previousPath !== filePath) {
      await supabase.storage.from("form-assets").remove([previousPath]);
    }

    const upload = await supabase.storage.from("form-assets").upload(filePath, file, {
      upsert: true,
    });

    if (upload.error) {
      setSaving(false);
      setMessage(upload.error.message);
      return;
    }

    const publicUrl = `${supabase.storage.from("form-assets").getPublicUrl(filePath).data.publicUrl}?v=${Date.now()}`;

    if (assetType === "header") {
      await patchForm(buildBuilderPatch(activeForm, { header_image_url: publicUrl }));
    } else {
      let frameAspect = activeForm.composite_template?.frameAspect ?? defaultCompositeTemplate.frameAspect;
      try {
        frameAspect = await getImageAspect(file);
      } catch (error) {
        console.error(error);
      }

      await patchForm({
        composite_template: {
          ...(activeForm.composite_template ?? defaultCompositeTemplate),
          frameUrl: publicUrl,
          frameAspect,
        },
      });
    }

    setSaving(false);
  }

  function saveFieldConfig(nextFields: FormField[]) {
    setBuilderDirty(true);
    if (!activeForm) return;
    setActiveForm({ ...activeForm, field_config: nextFields });
  }

  async function saveBuilderDraft() {
    if (!activeForm) return;
    await patchForm(buildBuilderPatch(activeForm));
  }

  function setFieldConfigDraft(nextFields: FormField[]) {
    saveFieldConfig(nextFields);
  }

  function updateFieldDraft(
    fieldId: string,
    updater: (field: FormField) => FormField,
    persist = false,
  ) {
    if (!activeForm) return;
    const nextFields = activeForm.field_config.map((field) =>
      field.id === fieldId ? updater(field) : field,
    );
    setFieldConfigDraft(nextFields);
    if (persist) {
      void saveFieldConfig(nextFields);
    }
  }

  async function savePostTemplate(nextTemplate: PostSegment[]) {
    await patchForm({ post_template: nextTemplate });
  }

  function updatePostTemplate(nextTemplate: PostSegment[], persist = false) {
    if (!activeForm) return;
    setActiveForm({ ...activeForm, post_template: nextTemplate });
    setPostTextDraft(postTemplateToEditorText(nextTemplate));
    setPostTextDirty(false);
    if (persist) {
      void savePostTemplate(nextTemplate);
    }
  }

  function insertPostFieldToken(fieldId: string) {
    const textarea = postTextEditorRef.current;
    const token = `{{${fieldId}}}`;

    if (!textarea) {
      setPostTextDraft((current) => `${current}${token}`);
      setPostTextDirty(true);
      return;
    }

    const start = textarea.selectionStart ?? postTextDraft.length;
    const end = textarea.selectionEnd ?? postTextDraft.length;
    const nextValue = `${postTextDraft.slice(0, start)}${token}${postTextDraft.slice(end)}`;

    setPostTextDraft(nextValue);
    setPostTextDirty(true);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + token.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function savePostTextDraft() {
    if (!activeForm) return;
    const nextTemplate = editorTextToPostTemplate(postTextDraft);
    setActiveForm({ ...activeForm, post_template: nextTemplate });
    setPostTextDirty(false);
    await savePostTemplate(nextTemplate);
  }

  async function saveCompositeTemplate(nextTemplate: CompositeTemplate) {
    await patchForm({ composite_template: nextTemplate });
  }

  function updateComposerDraft(updater: (template: CompositeTemplate) => CompositeTemplate) {
    if (!activeForm) return;
    const currentTemplate = activeForm.composite_template ?? defaultCompositeTemplate;
    setActiveForm({
      ...activeForm,
      composite_template: updater(currentTemplate),
    });
  }

  function applyComposerTemplate(
    updater: (template: CompositeTemplate) => CompositeTemplate,
    persist = false,
  ) {
    if (!activeForm) return;
    const nextTemplate = updater(activeForm.composite_template ?? defaultCompositeTemplate);
    setActiveForm({
      ...activeForm,
      composite_template: nextTemplate,
    });
    if (persist) {
      void saveCompositeTemplate(nextTemplate);
    }
  }

  function persistCurrentCompositeTemplate() {
    if (!activeForm) return;
    void saveCompositeTemplate(activeForm.composite_template ?? defaultCompositeTemplate);
  }

  async function addTextLayerToComposer() {
    if (!activeForm) return;
    const nextLayerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
    const nextTemplate = {
      ...(activeForm.composite_template ?? defaultCompositeTemplate),
      textLayers: [
        ...(activeForm.composite_template?.textLayers ?? []),
        {
          id: nextLayerId,
          fieldId:
            activeForm.field_config.find((field) => field.type !== "image")?.id ?? "shopName",
          x: 6,
          y: 80,
          w: 88,
          fontSize: 12,
          fontFamily: "'Noto Sans JP', sans-serif",
          color: "#18212f",
          bold: false,
          align: "left" as const,
        },
      ],
    };
    setSelectedComposerLayerId(nextLayerId);
    await saveCompositeTemplate(nextTemplate);
  }

  async function removeTextLayerFromComposer(layerId: string) {
    if (!activeForm) return;
    const nextTemplate = {
      ...(activeForm.composite_template ?? defaultCompositeTemplate),
      textLayers: (activeForm.composite_template?.textLayers ?? []).filter(
        (layer) => layer.id !== layerId,
      ),
    };
    setSelectedComposerLayerId("photo");
    await saveCompositeTemplate(nextTemplate);
  }

  async function saveResponse(response: ResponseWithImages) {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase
      .from("responses")
      .update({
        data: response.data,
        per_image_tpls: response.perImageTpls ?? null,
        is_dirty: false,
      })
      .eq("id", response.id);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setResponses((current) =>
      current.map((item) => (item.id === response.id ? { ...response, isDirty: false } : item)),
    );
  }

  function openImageEditor(responseId: string, imageIndex: number) {
    setImageEditorTarget({ responseId, imageIndex });
    setImageEditorSelectedLayerId("photo");
  }

  function updatePerImageTemplate(
    responseId: string,
    imageIndex: number,
    updater: (template: CompositeTemplate) => CompositeTemplate,
  ) {
    if (!activeForm) return;
    setResponses((current) =>
      current.map((response) => {
        if (response.id !== responseId) return response;
        const templates = [...(response.perImageTpls ?? [])];
        const baseTemplate =
          templates[imageIndex] ?? response.perImageTpls?.[imageIndex] ?? activeForm.composite_template ?? defaultCompositeTemplate;
        templates[imageIndex] = updater(baseTemplate);
        return {
          ...response,
          isDirty: true,
          perImageTpls: templates,
        };
      }),
    );
  }

  async function persistPerImageTemplate(responseId: string) {
    const response = responses.find((item) => item.id === responseId);
    if (!response) return;
    await saveResponse(response);
  }

  async function downloadResponseImages(response: ResponseWithImages) {
    if (!activeForm) return;
    const images = response.images ?? [];
    if (!images.length) return;

    const renderedImages = await Promise.all(
      images.map(async (imageUrl, index) => {
        const template =
          response.perImageTpls?.[index] ??
          activeForm.composite_template ??
          defaultCompositeTemplate;

        const [photoImage, frameImage] = await Promise.all([
          loadBrowserImage(imageUrl),
          template.frameUrl ? loadBrowserImage(template.frameUrl) : Promise.resolve(null),
        ]);

        const canvas = document.createElement("canvas");
        const canvasWidth = frameImage?.naturalWidth || photoImage.naturalWidth || 1200;
        const canvasHeight =
          frameImage?.naturalHeight ||
          Math.round(canvasWidth / (template.frameAspect || 1)) ||
          photoImage.naturalHeight ||
          1200;

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("PNG 変換に失敗しました。");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        const resolvedPhotoArea = resolvePhotoArea(template);
        const photoX = (resolvedPhotoArea.x / 100) * canvasWidth;
        const photoY = (resolvedPhotoArea.y / 100) * canvasHeight;
        const photoW = (resolvedPhotoArea.w / 100) * canvasWidth;
        const photoH = (resolvedPhotoArea.h / 100) * canvasHeight;

        drawContainedImage(context, photoImage, photoX, photoY, photoW, photoH);

        if (frameImage) {
          context.drawImage(frameImage, 0, 0, canvasWidth, canvasHeight);
        }

        template.textLayers.forEach((layer) => {
          const raw = response.data[layer.fieldId];
          const text = Array.isArray(raw) ? raw.join(" / ") : String(raw ?? "");
          if (!text) return;

          const drawX = (layer.x / 100) * canvasWidth;
          const drawY = (layer.y / 100) * canvasHeight;
          const drawW = (layer.w / 100) * canvasWidth;
          const fontSize = layer.fontSize * (canvasWidth / COMPOSITE_REFERENCE_WIDTH);

          context.font = `${layer.bold ? "700" : "400"} ${Math.max(fontSize, 12)}px ${layer.fontFamily ?? "'Noto Sans JP', sans-serif"}`;
          context.fillStyle = layer.color;
          context.textBaseline = "top";

          if (layer.align === "center") {
            context.textAlign = "center";
            context.fillText(text, drawX + drawW / 2, drawY, drawW);
          } else if (layer.align === "right") {
            context.textAlign = "right";
            context.fillText(text, drawX + drawW, drawY, drawW);
          } else {
            context.textAlign = "left";
            context.fillText(text, drawX, drawY, drawW);
          }
        });

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png"),
        );

        if (!blob) {
          throw new Error("PNG 生成に失敗しました。");
        }

        return {
          blob,
          fileName: `response-${response.id}-${index + 1}.png`,
        };
      }),
    );

    const supportsDirectoryPicker =
      typeof window !== "undefined" && "showDirectoryPicker" in window;

    if (supportsDirectoryPicker) {
      try {
        const directoryHandle = await (
          window as unknown as {
            showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker();

        await Promise.all(
          renderedImages.map(async ({ blob, fileName }) => {
            const fileHandle = await directoryHandle.getFileHandle(fileName, {
              create: true,
            });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
          }),
        );

        setMessage("保存先フォルダに PNG を書き出しました。");
        return;
      } catch (error) {
        console.error(error);
      }
    }

    renderedImages.forEach(({ blob, fileName }) => {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    });
  }

  async function seedSampleResponses() {
    if (!supabase || !activeForm) return;
    setSaving(true);
    setMessage(null);

    const payload = Array.from({ length: 3 }).map((_, index) => ({
      form_id: activeForm.id,
      data: createSampleResponseData(activeForm.field_config, index),
    }));

    const result = await supabase
      .from("responses")
      .insert(payload)
      .select("id,form_id,data,per_image_tpls,is_dirty,submitted_at,updated_at");

    setSaving(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    const nextResponses = ((result.data ?? []) as DbResponseRow[]).map((response) =>
      mapResponseRow(response, supabase),
    );
    setResponses((current) => [...nextResponses, ...current]);
    setMessage("サンプル回答を追加しました。");
  }

  async function seedSampleResponseWithImage() {
    if (!supabase || !activeForm) return;
    setSaving(true);
    setMessage(null);

    const responseResult = await supabase
      .from("responses")
      .insert({
        form_id: activeForm.id,
        data: createSampleResponseData(activeForm.field_config, responses.length),
      })
      .select("id,form_id,data,per_image_tpls,is_dirty,submitted_at,updated_at")
      .single();

    if (responseResult.error || !responseResult.data) {
      setSaving(false);
      setMessage(responseResult.error?.message ?? "画像付きサンプル回答の作成に失敗しました。");
      return;
    }

    const svg = createSampleImageSvg(responseResult.data.id);
    const storagePath = `${activeForm.id}/${responseResult.data.id}/sample-image.svg`;
    const file = new File([svg], "sample-image.svg", { type: "image/svg+xml" });

    const uploadResult = await supabase.storage.from("response-images").upload(storagePath, file, {
      upsert: true,
      contentType: "image/svg+xml",
    });

    if (uploadResult.error) {
      setSaving(false);
      setMessage(uploadResult.error.message);
      return;
    }

    const imageRowResult = await supabase
      .from("response_images")
      .insert({ response_id: responseResult.data.id, storage_path: storagePath, position: 0 });

    if (imageRowResult.error) {
      setSaving(false);
      setMessage(imageRowResult.error.message);
      return;
    }

    const mapped = mapResponseRow(
      {
        ...(responseResult.data as DbResponseRow),
        response_images: [{ storage_path: storagePath, position: 0 }],
      },
      supabase,
    );

    setResponses((current) => [mapped, ...current]);
    setSaving(false);
    setMessage("画像付きサンプル回答を追加しました。");
  }

  function updateResponseValue(responseId: string, fieldId: string, value: string) {
    setResponses((current) =>
      current.map((response) =>
        response.id === responseId
          ? {
              ...response,
              isDirty: true,
              data: { ...response.data, [fieldId]: value },
            }
          : response,
      ),
    );
  }

  function createEmptyField(type: FormField["type"] = "text"): FormField {
    return {
      id: `field-${crypto.randomUUID()}`,
      type,
      label: "新しい質問",
      required: false,
      placeholder: "",
      hint: "",
      options: type === "radio" || type === "checkbox" ? ["選択肢 1"] : [],
      maxLength: type === "textarea" ? 200 : undefined,
      maxCount: type === "image" ? 4 : undefined,
    };
  }

  async function appendField(type: FormField["type"] = "text") {
    if (!activeForm) return;
    const nextField = createEmptyField(type);
    setSelectedFieldId(nextField.id);
    saveFieldConfig([...activeForm.field_config, nextField]);
  }

  function duplicateField(field: FormField) {
    if (!activeForm) return;
    const duplicate: FormField = {
      ...field,
      id: `field-${crypto.randomUUID()}`,
      label: `${field.label} コピー`,
      options: field.options ? [...field.options] : [],
    };
    const index = activeForm.field_config.findIndex((item) => item.id === field.id);
    const nextFields = [...activeForm.field_config];
    nextFields.splice(index + 1, 0, duplicate);
    setSelectedFieldId(duplicate.id);
    saveFieldConfig(nextFields);
  }

  if (!isSupabaseConfigured()) {
    return <ConfigNotice />;
  }

  if (loading) {
    return <div className="page-state">読み込み中...</div>;
  }

  if (tenants.length === 0) {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card">
          <div className="eyebrow">Supabase Setup</div>
          <h1>最初のテナントを作成</h1>
          <p>
            ログイン済みのユーザー <strong>{initialUserEmail}</strong> をオーナーとして登録します。
          </p>
          <form onSubmit={createTenant} className="stack-form">
            <label>
              テナント名
              <input
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="例：わんにゃん運営"
                required
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? "作成中..." : "テナントと初期フォームを作成"}
            </button>
          </form>
          {message ? <div className="inline-message">{message}</div> : null}
        </div>
      </div>
    );
  }

  const activeTenant =
    tenants.find((tenant) => tenant.slug === tenantSlug) ?? tenants[0] ?? null;
  const routeTenantSlug = activeTenant?.slug || activeTenant?.id || "tenant";
  const navItems = [
    { key: "builder", label: "フォームビルダー" },
    { key: "answers", label: "回答一覧" },
    { key: "composer", label: "画像合成設定" },
    { key: "posttext", label: "投稿文設定" },
  ] as const;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>Event Booth Studio</span>
          <small>{initialUserEmail}</small>
        </div>

        <div className="sidebar-section">Tenant</div>
        <div className="tenant-list">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className={`tenant-chip ${tenant.id === activeTenant?.id ? "active" : ""}`}
            >
              {tenant.name}
            </div>
          ))}
        </div>

        <div className="sidebar-section">Forms</div>
        <nav className="sidebar-nav">
          <div className="sidebar-nav-scroll">
            {forms.map((form) => (
              <div key={form.id} className="form-accordion">
                <button
                  type="button"
                  className={`form-accordion-trigger ${
                    openFormId === form.id ? "open" : ""
                  } ${activeForm?.id === form.id ? "current" : ""}`}
                  onClick={() =>
                    setOpenFormId((current) => (current === form.id ? null : form.id))
                  }
                >
                  <div className="form-accordion-copy">
                    <span className="form-nav-title">{form.name}</span>
                    <small>{form.status === "open" ? "公開中" : "終了"}</small>
                  </div>
                  <span className="form-accordion-icon">
                    {openFormId === form.id ? "▾" : "▸"}
                  </span>
                </button>
                {openFormId === form.id ? (
                  <div className="form-accordion-panel">
                    {navItems.map((item) => (
                      <Link
                        key={item.key}
                        href={`/admin/${routeTenantSlug}/${form.id}/${item.key}`}
                        className={mode === item.key && activeForm?.id === form.id ? "active" : ""}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <button
                      type="button"
                      className="form-delete-button"
                      onClick={() => void deleteForm(form)}
                    >
                      フォーム削除
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </nav>

        <form onSubmit={createForm} className="sidebar-create">
          <input
            value={newFormName}
            onChange={(event) => setNewFormName(event.target.value)}
            placeholder="新規フォーム名"
          />
          <button type="submit" disabled={saving}>
            追加
          </button>
        </form>

        <button type="button" className="ghost-button" onClick={signOut}>
          ログアウト
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <div className="eyebrow">
              {mode === "builder"
                ? "Builder"
                : mode === "answers"
                  ? "Responses"
                  : mode === "composer"
                    ? "Composer"
                    : mode === "posttext"
                      ? "Post Text"
                      : "Admin"}
            </div>
            <h1>{activeForm?.header_title ?? "フォームを選択してください"}</h1>
            {activeForm ? (
              <p>
                公開URL
                <Link href={`/f/${activeForm.id}`} target="_blank">
                  /f/{activeForm.id}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="header-actions">
            {message ? <span className="inline-message">{message}</span> : null}
            {saving ? <span className="saving-state">保存中...</span> : null}
          </div>
        </header>

        {!activeForm ? (
          <div className="page-state">フォームがまだありません。</div>
        ) : null}

        {activeForm && mode === "builder" ? (
          <div className="builder-proto">
            <section className="panel-card hero-panel">
              <div className="panel-head">
                <div>
                  <h2>ヘッダー設定</h2>
                  <p>公開フォーム上部の見出しとビジュアルです。</p>
                </div>
                {builderDirty ? (
                  <button
                    type="button"
                    onClick={() => void saveBuilderDraft()}
                  >
                    一括保存
                  </button>
                ) : null}
              </div>
              <div className="stack-form">
                <label>
                  イベントタイトル
                  <input
                    value={activeForm.header_title}
                    onChange={(event) => {
                      setActiveForm({ ...activeForm, header_title: event.target.value });
                      setBuilderDirty(true);
                    }}
                  />
                </label>
                <label>
                  サブタイトル
                  <input
                    value={activeForm.header_subtitle}
                    onChange={(event) => {
                      setActiveForm({ ...activeForm, header_subtitle: event.target.value });
                      setBuilderDirty(true);
                    }}
                  />
                </label>
                <label>
                  説明文
                  <textarea
                    value={activeForm.description}
                    onChange={(event) => {
                      setActiveForm({ ...activeForm, description: event.target.value });
                      setBuilderDirty(true);
                    }}
                  />
                </label>
                <label>
                  ヘッダー画像
                  <input type="file" accept="image/*" onChange={(event) => uploadAsset(event, "header")} />
                </label>
                {activeForm.header_image_url ? (
                  <img className="asset-preview" src={activeForm.header_image_url} alt="" />
                ) : null}
              </div>
            </section>

            <section className="panel-card builder-panel">
              <div className="panel-head builder-panel-head">
                <div>
                  <h2>フォーム項目</h2>
                  <p>Google Forms のように、質問カードを選んで右側で詳細を編集します。</p>
                </div>
                <button
                  type="button"
                  onClick={() => appendField("text")}
                >
                  項目追加
                </button>
              </div>

              <div className="builder-quick-add">
                {FIELD_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="quick-add-chip"
                    onClick={() => appendField(option.value)}
                  >
                    + {option.label}
                  </button>
                ))}
              </div>

              <div className="builder-columns proto">
                <div className="field-list proto">
                  {activeForm.field_config.map((field, index) => (
                    <div
                      key={field.id}
                      className={`field-row field-card ${selectedFieldId === field.id ? "selected" : ""}`}
                      onClick={() =>
                        setSelectedFieldId((current) => (current === field.id ? null : field.id))
                      }
                    >
                      <div className="field-card-top">
                        <div className="field-card-summary">
                          <div className="field-card-summary-copy">
                            <div className="field-row-tag">
                              {FIELD_TYPE_OPTIONS.find((item) => item.value === field.type)?.label}
                              {field.required ? " / 必須" : " / 任意"}
                            </div>
                            <strong>{field.label || "未設定"}</strong>
                            <span>{field.hint || field.placeholder || "説明文は未設定です。"}</span>
                          </div>
                        </div>
                        <div className="field-row-actions button-row">
                          <button
                            type="button"
                            className="field-action-button icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              const nextFields = [...activeForm.field_config];
                              if (index === 0) return;
                              [nextFields[index - 1], nextFields[index]] = [
                                nextFields[index],
                                nextFields[index - 1],
                              ];
                              saveFieldConfig(nextFields);
                            }}
                            aria-label="上に移動"
                            title="上に移動"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="field-action-button icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              const nextFields = [...activeForm.field_config];
                              if (index === nextFields.length - 1) return;
                              [nextFields[index + 1], nextFields[index]] = [
                                nextFields[index],
                                nextFields[index + 1],
                              ];
                              saveFieldConfig(nextFields);
                            }}
                            aria-label="下に移動"
                            title="下に移動"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="field-action-button icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              duplicateField(field);
                            }}
                            aria-label="複製"
                            title="複製"
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            className="field-action-button icon danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              saveFieldConfig(
                                activeForm.field_config.filter((item) => item.id !== field.id),
                              );
                            }}
                            aria-label="削除"
                            title="削除"
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            className="field-action-button icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedFieldId((current) => (current === field.id ? null : field.id));
                            }}
                            aria-label={selectedFieldId === field.id ? "折りたたむ" : "展開する"}
                            title={selectedFieldId === field.id ? "折りたたむ" : "展開する"}
                          >
                            {selectedFieldId === field.id ? "▾" : "▸"}
                          </button>
                        </div>
                      </div>

                      {selectedFieldId === field.id ? (
                        <div className="field-card-body">
                          <input
                            className="field-card-title"
                            value={field.label}
                            placeholder="質問"
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateFieldDraft(field.id, (current) => ({
                                ...current,
                                label: event.target.value,
                              }))
                            }
                            onBlur={() => undefined}
                          />

                          <div className="field-card-type-row">
                            <select
                              value={field.type}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                updateFieldDraft(
                                  field.id,
                                  (current) => ({
                                    ...current,
                                    type: event.target.value as FormField["type"],
                                    options:
                                      event.target.value === "radio" ||
                                      event.target.value === "checkbox"
                                        ? current.options?.length
                                          ? current.options
                                          : ["選択肢 1"]
                                        : [],
                                    maxLength:
                                      event.target.value === "textarea"
                                        ? current.maxLength ?? 200
                                        : undefined,
                                    maxCount:
                                      event.target.value === "image"
                                        ? current.maxCount ?? 4
                                        : undefined,
                                  }),
                                  false,
                                )
                              }
                            >
                              {FIELD_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>

                            <label className="field-inline-toggle" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(event) =>
                                  updateFieldDraft(
                                    field.id,
                                    (current) => ({ ...current, required: event.target.checked }),
                                    false,
                                  )
                                }
                              />
                              必須
                            </label>
                          </div>

                          <textarea
                            className="field-card-description"
                            value={field.hint ?? ""}
                            placeholder="説明文"
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              updateFieldDraft(field.id, (current) => ({
                                ...current,
                                hint: event.target.value,
                              }))
                            }
                            onBlur={() => undefined}
                          />

                          {field.type !== "radio" &&
                          field.type !== "checkbox" &&
                          field.type !== "image" ? (
                            <input
                              value={field.placeholder ?? ""}
                              placeholder="入力例"
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                updateFieldDraft(field.id, (current) => ({
                                  ...current,
                                  placeholder: event.target.value,
                                }))
                              }
                              onBlur={() => undefined}
                            />
                          ) : null}

                          {(field.type === "radio" || field.type === "checkbox") && (
                            <div className="field-card-options" onClick={(event) => event.stopPropagation()}>
                              {(field.options ?? []).map((option, optionIndex) => (
                                <div key={`${field.id}-${optionIndex}`} className="field-card-option-row">
                                  <span className="field-card-option-prefix">
                                    {field.type === "radio" ? "◯" : "☐"}
                                  </span>
                                  <input
                                    value={option}
                                    onChange={(event) =>
                                      updateFieldDraft(field.id, (current) => ({
                                        ...current,
                                        options: (current.options ?? []).map((item, idx) =>
                                          idx === optionIndex ? event.target.value : item,
                                        ),
                                      }))
                                    }
                                    onBlur={() => undefined}
                                  />
                                  <button
                                    type="button"
                                    className="field-card-option-remove"
                                    onClick={() => {
                                      const nextOptions = (field.options ?? []).filter(
                                        (_, idx) => idx !== optionIndex,
                                      );
                                      updateFieldDraft(
                                        field.id,
                                        (current) => ({
                                          ...current,
                                          options: nextOptions.length ? nextOptions : ["選択肢 1"],
                                        }),
                                        false,
                                      );
                                    }}
                                  >
                                    削除
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="field-card-option-add"
                                onClick={() =>
                                  updateFieldDraft(
                                    field.id,
                                    (current) => ({
                                      ...current,
                                      options: [
                                        ...(current.options ?? []),
                                        `選択肢 ${(current.options?.length ?? 0) + 1}`,
                                      ],
                                    }),
                                    false,
                                  )
                                }
                              >
                                + 選択肢を追加
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="field-editor proto">
                  {selectedField ? (
                    <>
                      <div className="field-editor-title">ライブプレビュー</div>
                      <div className="field-editor-subtitle">
                        主な編集は左のカードで行います。右側では公開フォーム上の見え方を確認できます。
                      </div>
                      {selectedField.type === "textarea" && (
                        <label>
                          最大文字数
                          <input
                            type="number"
                            value={selectedField.maxLength ?? 200}
                            onChange={(event) => {
                              updateFieldDraft(selectedField.id, (current) => ({
                                ...current,
                                maxLength: Number(event.target.value),
                              }));
                            }}
                            onBlur={() => undefined}
                          />
                        </label>
                      )}
                      {selectedField.type === "image" && (
                        <label>
                          最大枚数
                          <input
                            type="number"
                            min={1}
                            max={8}
                            value={selectedField.maxCount ?? 4}
                            onChange={(event) => {
                              updateFieldDraft(selectedField.id, (current) => ({
                                ...current,
                                maxCount: Number(event.target.value),
                              }));
                            }}
                            onBlur={() => undefined}
                          />
                        </label>
                      )}
                      <div className="field-editor-preview">
                        <div className="field-editor-preview-label">
                          {selectedField.label || "新しい質問"}
                          <span>{selectedField.required ? "必須" : "任意"}</span>
                        </div>
                        <div className="field-editor-preview-body">
                          {selectedField.type === "textarea" && (
                            <textarea placeholder={selectedField.placeholder || "回答を入力"} disabled />
                          )}
                          {selectedField.type === "radio" && (
                            <div className="preview-options">
                              {(selectedField.options ?? []).map((option) => (
                                <label key={option}><input type="radio" disabled />{option}</label>
                              ))}
                            </div>
                          )}
                          {selectedField.type === "checkbox" && (
                            <div className="preview-options">
                              {(selectedField.options ?? []).map((option) => (
                                <label key={option}><input type="checkbox" disabled />{option}</label>
                              ))}
                            </div>
                          )}
                          {selectedField.type === "image" && (
                            <div className="preview-upload-box">画像アップロード {selectedField.maxCount ?? 4}枚まで</div>
                          )}
                          {(selectedField.type === "text" ||
                            selectedField.type === "email" ||
                            selectedField.type === "url") && (
                            <input
                              type={selectedField.type}
                              placeholder={selectedField.placeholder || "短文回答"}
                              disabled
                            />
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="page-state compact">左の項目を選択してください。</div>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeForm && mode === "answers" ? (
          <section className="answers-layout">
            <div className="answers-toolbar panel-card">
              <div className="panel-head">
                <div>
                  <h2>回答一覧</h2>
                  <p>検索・絞り込みしながらセル編集できます。</p>
                </div>
                <div className="answers-head-actions">
                  {!responses.length ? (
                    <button type="button" onClick={() => void seedSampleResponses()}>
                      サンプル回答を追加
                    </button>
                  ) : null}
                  <button type="button" className="ghost-button" onClick={() => void seedSampleResponseWithImage()}>
                    画像付きサンプルを追加
                  </button>
                </div>
              </div>
              <div className="answers-filters">
                <input
                  placeholder="店舗名・メール・説明文で検索"
                  value={answerSearch}
                  onChange={(event) => setAnswerSearch(event.target.value)}
                />
                <select
                  value={answerGenre}
                  onChange={(event) => setAnswerGenre(event.target.value)}
                >
                  <option value="all">すべてのジャンル</option>
                  {genreOptions.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="answers-summary">
                <div className="answer-stat">
                  <strong>{responses.length}</strong>
                  <span>総回答数</span>
                </div>
                <div className="answer-stat">
                  <strong>{filteredResponses.length}</strong>
                  <span>表示中</span>
                </div>
                <div className="answer-stat">
                  <strong>{responses.filter((item) => item.isDirty).length}</strong>
                  <span>未保存</span>
                </div>
              </div>
            </div>

            <div className="responses-table panel-card">
              <table>
                <thead>
                  <tr>
                    <th>受付日時</th>
                    {activeForm.field_config
                      .filter((field) => field.type !== "image")
                      .map((field) => (
                        <th key={field.id}>{field.label}</th>
                      ))}
                    <th>合成画像（クリックで個別調整）</th>
                    <th>投稿文</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredResponses.map((response) => (
                    <tr key={response.id} className={response.isDirty ? "dirty" : ""}>
                      <td>
                        <div className="submitted-at">
                          {new Date(response.submittedAt).toLocaleString("ja-JP")}
                        </div>
                      </td>
                      {activeForm.field_config
                        .filter((field) => field.type !== "image")
                        .map((field) => (
                          <td key={field.id}>
                            <input
                              value={String(response.data[field.id] ?? "")}
                              onChange={(event) =>
                                updateResponseValue(response.id, field.id, event.target.value)
                              }
                            />
                          </td>
                        ))}
                      <td>
                        <div className="image-card-grid">
                          {response.images.length ? (
                            response.images.map((image, imageIndex) => (
                              <button
                                key={image}
                                type="button"
                                className="image-card"
                                onClick={() => openImageEditor(response.id, imageIndex)}
                              >
                                <div className="image-card-preview">
                                  <CompositePreview
                                    template={
                                      response.perImageTpls?.[imageIndex] ??
                                      activeForm.composite_template ??
                                      defaultCompositeTemplate
                                    }
                                    values={response.data}
                                    imageUrl={image}
                                  />
                                </div>
                                <span>{imageIndex + 1}</span>
                              </button>
                            ))
                          ) : (
                            <span className="muted">未登録</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <pre className="post-snippet">
                          {renderPostText(activeForm.post_template, response.data)}
                        </pre>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="ghost-button" onClick={() => void downloadResponseImages(response)}>
                            画像保存
                          </button>
                          <button type="button" onClick={() => saveResponse(response)}>
                            {response.isDirty ? "保存" : "更新済み"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {imageEditorTarget ? (
              (() => {
                const response = responses.find((item) => item.id === imageEditorTarget.responseId) ?? null;
                if (!response || !activeForm) return null;
                const imageUrl = response.images[imageEditorTarget.imageIndex] ?? null;
                const template =
                  response.perImageTpls?.[imageEditorTarget.imageIndex] ??
                  activeForm.composite_template ??
                  defaultCompositeTemplate;

                return (
                  <div className="image-editor-modal" onClick={() => setImageEditorTarget(null)}>
                    <div className="image-editor-dialog" onClick={(event) => event.stopPropagation()}>
                      <div className="image-editor-head">
                        <div>
                          <h3>画像個別調整</h3>
                          <p>{String(response.data.shopName ?? response.data.shop ?? "サンプル画像")}</p>
                        </div>
                        <div className="image-editor-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setImageEditorTarget(null)}
                          >
                            閉じる
                          </button>
                          <button
                            type="button"
                            onClick={() => void persistPerImageTemplate(response.id)}
                          >
                            保存
                          </button>
                        </div>
                      </div>

                      <div className="image-editor-layout">
                        <div className="image-editor-elements">
                          <div className="composer-section-label">調整対象</div>
                          <button
                            type="button"
                            className={`composer-element-row ${imageEditorSelectedLayerId === "photo" ? "active" : ""}`}
                            onClick={() => setImageEditorSelectedLayerId("photo")}
                          >
                            <span className="composer-asset-icon">📷</span>
                            <span>出店者画像エリア</span>
                          </button>

                          <div className="composer-section-label">テキスト</div>
                          <div className="composer-elements-list">
                            {template.textLayers.map((layer) => (
                              <button
                                key={layer.id}
                                type="button"
                                className={`composer-element-row ${imageEditorSelectedLayerId === layer.id ? "active" : ""}`}
                                onClick={() => setImageEditorSelectedLayerId(layer.id)}
                              >
                                <span className="composer-asset-icon">T</span>
                                <span>
                                  {activeForm.field_config.find((field) => field.id === layer.fieldId)?.label ??
                                    layer.fieldId}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="image-editor-preview">
                          <div className="image-editor-indexes">
                            {response.images.map((_, index) => (
                              <button
                                key={`${response.id}-${index}`}
                                type="button"
                                className={imageEditorTarget.imageIndex === index ? "active" : ""}
                                onClick={() => {
                                  setImageEditorTarget({ responseId: response.id, imageIndex: index });
                                  setImageEditorSelectedLayerId("photo");
                                }}
                              >
                                {index + 1}
                              </button>
                            ))}
                          </div>
                          <CompositePreview
                            template={template}
                            values={response.data}
                            imageUrl={imageUrl}
                            selectedLayerId={imageEditorSelectedLayerId}
                            onSelectLayer={setImageEditorSelectedLayerId}
                          />
                        </div>

                        <div className="image-editor-props">
                          {imageEditorSelectedLayerId === "photo" ? (
                            <>
                              <div className="composer-props-title">📷 出店者画像エリア</div>
                              {[
                                ["x", "X", template.photoArea.x, 0, 80],
                                ["y", "Y", template.photoArea.y, 0, 80],
                                ["scale", "Scale", getPhotoScale(template), 40, 180],
                              ].map(([key, label, value, min, max]) => (
                                <label key={key} className="composer-slider-row">
                                  <span>{label}</span>
                                  <input
                                    type="range"
                                    min={Number(min)}
                                    max={Number(max)}
                                    value={Number(value)}
                                    onChange={(event) =>
                                      updatePerImageTemplate(response.id, imageEditorTarget.imageIndex, (current) => ({
                                        ...current,
                                        photoArea: {
                                          ...current.photoArea,
                                          [key]: Number(event.target.value),
                                        },
                                      }))
                                    }
                                  />
                                  <strong>{value}</strong>
                                </label>
                              ))}
                            </>
                          ) : (
                            (() => {
                              const layer =
                                template.textLayers.find((item) => item.id === imageEditorSelectedLayerId) ?? null;
                              if (!layer) {
                                return <div className="page-state compact">要素を選択してください。</div>;
                              }
                              return (
                                <>
                                  <div className="composer-props-title">T テキスト</div>
                                  {[
                                    ["x", "X", layer.x, 0, 90],
                                    ["y", "Y", layer.y, 0, 95],
                                    ["w", "W", layer.w, 20, 100],
                                    ["fontSize", "px", layer.fontSize, 8, 32],
                                  ].map(([key, label, value, min, max]) => (
                                    <label key={key} className="composer-slider-row">
                                      <span>{label}</span>
                                      <input
                                        type="range"
                                        min={Number(min)}
                                        max={Number(max)}
                                        value={Number(value)}
                                        onChange={(event) =>
                                          updatePerImageTemplate(response.id, imageEditorTarget.imageIndex, (current) => ({
                                            ...current,
                                            textLayers: current.textLayers.map((item) =>
                                              item.id === layer.id
                                                ? { ...item, [key]: Number(event.target.value) }
                                                : item,
                                            ),
                                          }))
                                        }
                                      />
                                      <strong>{value}</strong>
                                    </label>
                                  ))}
                                  <div className="composer-inline-actions">
                                    {[
                                      ["left", "左"],
                                      ["center", "中央"],
                                      ["right", "右"],
                                    ].map(([value, label]) => (
                                      <button
                                        key={value}
                                        type="button"
                                        className={layer.align === value ? "active" : ""}
                                        onClick={() =>
                                          updatePerImageTemplate(response.id, imageEditorTarget.imageIndex, (current) => ({
                                            ...current,
                                            textLayers: current.textLayers.map((item) =>
                                              item.id === layer.id
                                                ? { ...item, align: value as "left" | "center" | "right" }
                                                : item,
                                            ),
                                          }))
                                        }
                                      >
                                        {label}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </section>
        ) : null}

        {activeForm && mode === "composer" ? (
          <section className="composer-workspace">
            <section className="panel-card composer-panel">
              <div className="panel-head">
                <div>
                  <h2>構成要素</h2>
                  <p>枠、写真エリア、テキストレイヤーを管理します。</p>
                </div>
              </div>
              <div className="composer-column elements">
                <div className="composer-section-label">枠画像</div>
                <label className="composer-asset-row">
                  <span className="composer-asset-icon">🖼</span>
                  <span>{activeForm.composite_template?.frameUrl ? "変更する" : "アップロード"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => uploadAsset(event, "frame")}
                  />
                </label>

                <div className="composer-section-label">出店者画像</div>
                <button
                  type="button"
                  className={`composer-element-row ${selectedComposerLayerId === "photo" ? "active" : ""}`}
                  onClick={() => setSelectedComposerLayerId("photo")}
                >
                  <span className="composer-asset-icon">📷</span>
                  <span>出店者画像エリア</span>
                </button>

                <div className="composer-section-label">テキスト</div>
                <div className="composer-elements-list">
                  {(activeForm.composite_template?.textLayers ?? []).map((layer) => (
                    <div key={layer.id} className="composer-text-row">
                      <button
                        type="button"
                        className={`composer-element-row ${selectedComposerLayerId === layer.id ? "active" : ""}`}
                        onClick={() => setSelectedComposerLayerId(layer.id)}
                      >
                        <span className="composer-text-mark">T</span>
                        <span>
                          {activeForm.field_config.find((field) => field.id === layer.fieldId)?.label ??
                            "テキスト"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="composer-remove"
                        onClick={() => void removeTextLayerFromComposer(layer.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="composer-add-text" onClick={() => void addTextLayerToComposer()}>
                  ＋ テキストを追加
                </button>
              </div>
            </section>

            <section className="panel-card composer-panel">
              <div className="panel-head">
                <div>
                  <h2>プレビュー</h2>
                  <p>中央の画像やテキストをクリックして選択できます。</p>
                </div>
              </div>
              <div className="composer-column canvas">
                <div className="composer-canvas-frame">
                  <CompositePreview
                    template={activeForm.composite_template ?? defaultCompositeTemplate}
                    values={responses[0]?.data ?? {}}
                    imageUrl={responses[0]?.images?.[0] ?? null}
                    selectedLayerId={selectedComposerLayerId}
                    onSelectLayer={setSelectedComposerLayerId}
                  />
                </div>
                <div className="composer-canvas-note">
                  枠画像をアップロードするとアスペクト比が自動設定されます
                </div>
              </div>
            </section>

            <section className="panel-card composer-panel">
              <div className="panel-head">
                <div>
                  <h2>プロパティ</h2>
                  <p>選択中の要素の位置、サイズ、表示内容を調整します。</p>
                </div>
              </div>
              <div className="composer-column props">
                {selectedComposerLayerId === "photo" ? (
                  <>
                    <div className="composer-props-title">📷 出店者画像エリア</div>
                    <div className="composer-props-group">位置・スケール</div>
                    {[
                      ["x", "X", activeForm.composite_template?.photoArea?.x ?? 6, 0, 80],
                      ["y", "Y", activeForm.composite_template?.photoArea?.y ?? 6, 0, 80],
                      [
                        "scale",
                        "Scale",
                        getPhotoScale(activeForm.composite_template ?? defaultCompositeTemplate),
                        40,
                        180,
                      ],
                    ].map(([key, label, value, min, max]) => (
                      <label key={key} className="composer-slider-row">
                        <span>{label}</span>
                        <input
                          type="range"
                          min={Number(min)}
                          max={Number(max)}
                          value={Number(value)}
                          onChange={(event) =>
                            applyComposerTemplate((template) => ({
                              ...template,
                              photoArea: {
                                ...template.photoArea,
                                [key]: Number(event.target.value),
                              },
                            }))
                          }
                          onMouseUp={persistCurrentCompositeTemplate}
                        />
                        <strong>{value}</strong>
                      </label>
                    ))}
                  </>
                ) : (
                  (() => {
                    const layer =
                      activeForm.composite_template?.textLayers.find(
                        (item) => item.id === selectedComposerLayerId,
                      ) ?? null;
                    if (!layer) {
                      return <div className="page-state compact">要素を選択してください。</div>;
                    }
                    return (
                      <>
                        <div className="composer-props-title">T テキスト</div>
                        <label className="composer-select-row">
                          <span>表示項目</span>
                          <select
                            value={layer.fieldId}
                            onChange={(event) => {
                              applyComposerTemplate((template) => ({
                                ...template,
                                textLayers: template.textLayers.map((item) =>
                                  item.id === layer.id ? { ...item, fieldId: event.target.value } : item,
                                ),
                              }), true);
                            }}
                          >
                            {activeForm.field_config
                              .filter((field) => field.type !== "image")
                              .map((field) => (
                                <option key={field.id} value={field.id}>
                                  {field.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <div className="composer-props-group">位置（%）</div>
                        {[
                          ["x", "X", layer.x, 0, 90],
                          ["y", "Y", layer.y, 0, 95],
                          ["w", "W", layer.w, 20, 100],
                          ["fontSize", "px", layer.fontSize, 8, 32],
                        ].map(([key, label, value, min, max]) => (
                          <label key={key} className="composer-slider-row">
                            <span>{label}</span>
                            <input
                              type="range"
                              min={Number(min)}
                              max={Number(max)}
                              value={Number(value)}
                              onChange={(event) =>
                                applyComposerTemplate((template) => ({
                                  ...template,
                                  textLayers: template.textLayers.map((item) =>
                                    item.id === layer.id
                                      ? { ...item, [key]: Number(event.target.value) }
                                      : item,
                                  ),
                                }))
                              }
                              onMouseUp={persistCurrentCompositeTemplate}
                            />
                            <strong>{value}</strong>
                          </label>
                        ))}
                        <label className="composer-select-row">
                          <span>フォント</span>
                          <select
                            value={layer.fontFamily ?? "'Noto Sans JP', sans-serif"}
                            onChange={(event) => {
                              applyComposerTemplate((template) => ({
                                ...template,
                                textLayers: template.textLayers.map((item) =>
                                  item.id === layer.id
                                    ? { ...item, fontFamily: event.target.value }
                                    : item,
                                ),
                              }), true);
                            }}
                          >
                            {FONT_FAMILY_OPTIONS.map((font) => (
                              <option key={font.value} value={font.value}>
                                {font.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="composer-select-row">
                          <span>カラー</span>
                          <input
                            type="color"
                            value={layer.color}
                            onChange={(event) => {
                              applyComposerTemplate((template) => ({
                                ...template,
                                textLayers: template.textLayers.map((item) =>
                                  item.id === layer.id ? { ...item, color: event.target.value } : item,
                                ),
                              }), true);
                            }}
                          />
                        </label>
                        <div className="composer-inline-actions">
                          {[
                            ["left", "左"],
                            ["center", "中央"],
                            ["right", "右"],
                          ].map(([value, label]) => (
                            <button
                            key={value}
                            type="button"
                            className={layer.align === value ? "active" : ""}
                            onClick={() => {
                              applyComposerTemplate((template) => ({
                                ...template,
                                textLayers: template.textLayers.map((item) =>
                                  item.id === layer.id
                                    ? { ...item, align: value as "left" | "center" | "right" }
                                    : item,
                                ),
                              }), true);
                            }}
                          >
                            {label}
                            </button>
                          ))}
                          <button
                          type="button"
                          className={layer.bold ? "active" : ""}
                          onClick={() => {
                            applyComposerTemplate((template) => ({
                              ...template,
                              textLayers: template.textLayers.map((item) =>
                                item.id === layer.id ? { ...item, bold: !item.bold } : item,
                              ),
                            }), true);
                          }}
                        >
                            太字
                          </button>
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            </section>
          </section>
        ) : null}

        {activeForm && mode === "posttext" ? (
          <section className="posttext-layout">
            <section className="posttext-editor">
              <div className="posttext-head">
                <div>
                  <h2>投稿文テンプレート</h2>
                  <p>自然文を書きながら、カーソル位置にフォーム項目タグを挿入できます。</p>
                </div>
                <div className="posttext-head-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      const nextText = postTemplateToEditorText(defaultPostTemplate);
                      setPostTextDraft(nextText);
                      setPostTextDirty(true);
                    }}
                  >
                    初期化
                  </button>
                  {postTextDirty ? (
                    <button type="button" onClick={() => void savePostTextDraft()}>
                      保存
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="posttext-insert">
                <span>挿入:</span>
                {activeForm.field_config
                  .filter((field) => field.type !== "image")
                  .map((field, index) => (
                    <button
                      key={field.id}
                      type="button"
                      className={`posttext-token tone-${index % 4}`}
                      onClick={() => insertPostFieldToken(field.id)}
                    >
                      + {field.label} <small>{`{{${field.id}}}`}</small>
                    </button>
                  ))}
              </div>

              <div className="posttext-canvas">
                <textarea
                  ref={postTextEditorRef}
                  className="posttext-editor-input"
                  value={postTextDraft}
                  onChange={(event) => {
                    setPostTextDraft(event.target.value);
                    setPostTextDirty(true);
                  }}
                  placeholder={"例:\n【出店者紹介】\n{{shopName}}\n出品ジャンル：{{genre}}\n出品品目：{{items}}"}
                />
              </div>

              <p className="posttext-note">
                <code>{"{{fieldId}}"}</code> 形式のタグが回答内容に置き換わります。回答一覧の投稿文列にも同じ文章が表示されます。
              </p>
            </section>

            <aside className="posttext-preview">
              <h2>プレビュー（サンプルデータ）</h2>
              <div className="posttext-preview-rich posttext-preview-plain">
                {responses[0] ? renderPostText(editorTextToPostTemplate(postTextDraft), responses[0].data) : postTextDraft}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  const text = responses[0]
                    ? renderPostText(editorTextToPostTemplate(postTextDraft), responses[0].data)
                    : "";
                  void navigator.clipboard?.writeText(text);
                }}
              >
                コピー
              </button>
              <div className="posttext-copy-hint">
                回答一覧の「投稿文」列に各出店者のデータで生成された文章が表示されます。
              </div>
            </aside>
          </section>
        ) : null}
      </main>
    </div>
  );
}
