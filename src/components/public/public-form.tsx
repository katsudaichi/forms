"use client";

import { FormEvent, useEffect, useState } from "react";

import { ConfigNotice } from "@/components/shared/config-notice";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { FormField } from "@/lib/types";

type PublicFormRow = {
  id: string;
  name: string;
  status: "open" | "closed";
  header_title: string;
  header_subtitle: string;
  description: string;
  header_image_url: string | null;
  field_config: FormField[];
};

export function PublicForm({ formId }: { formId: string }) {
  const supabase = createClient();
  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const result = await supabase
        .from("forms")
        .select("id,name,status,header_title,header_subtitle,description,header_image_url,field_config")
        .eq("id", formId)
        .single();

      if (!result.error) {
        setForm(result.data as PublicFormRow);
      }
      setLoading(false);
    }

    void load();
  }, [formId, supabase]);

  function updateField(fieldId: string, value: string | string[]) {
    setValues((current) => ({ ...current, [fieldId]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase 環境変数が未設定です。");
      return;
    }
    if (!form) return;

    const hasRequiredImageField = form.field_config.some(
      (field) => field.type === "image" && field.required,
    );
    const validFiles = files.filter(Boolean);

    if (hasRequiredImageField && validFiles.length === 0) {
      setMessage("必須の画像を1枚以上アップロードしてください。");
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const responseInsert = await supabase
      .from("responses")
      .insert({
        form_id: form.id,
        data: values,
      })
      .select("id")
      .single();

    if (responseInsert.error || !responseInsert.data) {
      setSubmitting(false);
      setMessage(responseInsert.error?.message ?? "送信に失敗しました。");
      return;
    }

    for (const [index, file] of validFiles.entries()) {
      const filePath = `${form.id}/${responseInsert.data.id}/${index}-${Date.now()}-${file.name}`;
      const upload = await supabase.storage.from("response-images").upload(filePath, file, {
        upsert: true,
      });

      if (!upload.error) {
        await supabase.from("response_images").insert({
          response_id: responseInsert.data.id,
          storage_path: filePath,
          position: index,
        });
      }
    }

    setSubmitting(false);
    setMessage(null);
    setShowComplete(true);
    setValues({});
    setFiles([]);
  }

  if (loading) {
    return <div className="page-state">読み込み中...</div>;
  }

  if (!isSupabaseConfigured()) {
    return <ConfigNotice />;
  }

  if (!form || form.status !== "open") {
    return <div className="page-state">このフォームは現在公開されていません。</div>;
  }

  return (
    <div className="public-shell">
      <div className="public-hero">
        {form.header_image_url ? (
          <img src={form.header_image_url} alt="" />
        ) : (
          <div className="public-hero-placeholder">イベントビジュアル</div>
        )}
        <h1>{form.header_title}</h1>
        <p>{form.header_subtitle}</p>
        {form.description ? <div className="public-hero-description">{form.description}</div> : null}
      </div>

      <form className="public-body" onSubmit={handleSubmit}>
        {form.field_config.map((field) => (
          <div key={field.id} className="public-field">
            <div className="public-field-head">
              <label>
                <strong>{field.label}</strong>
                {field.hint ? <span>{field.hint}</span> : null}
              </label>
              <div className={`public-field-badge ${field.required ? "required" : ""}`}>
                {field.required ? "必須" : "任意"}
              </div>
            </div>

            {["text", "email", "url"].includes(field.type) ? (
              <input
                type={field.type}
                value={String(values[field.id] ?? "")}
                placeholder={field.placeholder}
                onChange={(event) => updateField(field.id, event.target.value)}
                required={field.required}
              />
            ) : null}

            {field.type === "textarea" ? (
              <div className="public-char-wrap">
                <textarea
                  value={String(values[field.id] ?? "")}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  onChange={(event) => updateField(field.id, event.target.value)}
                  required={field.required}
                />
                {field.maxLength ? (
                  <span className="public-char-count">
                    {String(values[field.id] ?? "").length}/{field.maxLength}
                  </span>
                ) : null}
              </div>
            ) : null}

            {field.type === "radio" ? (
              <div className="chip-group public-chip-group">
                {(field.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={values[field.id] === option ? "active" : ""}
                    onClick={() => updateField(field.id, option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}

            {field.type === "checkbox" ? (
              <div className="chip-group public-chip-group">
                {(field.options ?? []).map((option) => {
                  const selected = Array.isArray(values[field.id])
                    ? (values[field.id] as string[]).includes(option)
                    : false;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={selected ? "active" : ""}
                      onClick={() => {
                        const current = Array.isArray(values[field.id])
                          ? ([...(values[field.id] as string[])] as string[])
                          : [];
                        updateField(
                          field.id,
                          selected
                            ? current.filter((item) => item !== option)
                            : [...current, option],
                        );
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {field.type === "image" ? (
              <div className="public-upload-box">
                <div className="public-upload-grid">
                  {Array.from({ length: field.maxCount ?? 4 }).map((_, index) => {
                    const preview = files[index];
                    return (
                      <label key={`${field.id}-${index}`} className={`public-upload-slot ${preview ? "filled" : ""}`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setFiles((current) => {
                              const next = [...current];
                              if (nextFile) {
                                next[index] = nextFile;
                              } else {
                                next.splice(index, 1);
                              }
                              return next.filter(Boolean);
                            });
                          }}
                        />
                        {preview ? (
                          <>
                            <img src={URL.createObjectURL(preview)} alt="" />
                            <button
                              type="button"
                              className="public-upload-remove"
                              onClick={(event) => {
                                event.preventDefault();
                                setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
                              }}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="public-upload-icon">📷</span>
                            <span className="public-upload-number">{index + 1}枚目</span>
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
                <span>インスタ投稿に使用します。最大 {field.maxCount ?? 4} 枚。</span>
              </div>
            ) : null}
          </div>
        ))}

        <div className="public-submit-area">
          <button className="submit-button" type="submit" disabled={submitting}>
            {submitting ? "送信中..." : "送信する"}
          </button>
          <p className="public-submit-note">送信後、担当者より確認メールをお送りします。</p>
          {message ? <div className="inline-message">{message}</div> : null}
        </div>
      </form>

      <div className={`public-complete-modal ${showComplete ? "show" : ""}`}>
        <div className="public-complete-card">
          <div className="public-complete-icon">🐾</div>
          <h2>登録完了しました</h2>
          <p>
            ありがとうございます。<br />
            担当者より順次ご連絡いたします。<br />
            当日お会いできるのを楽しみにしています。
          </p>
          <button type="button" onClick={() => setShowComplete(false)}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
