import type { Metadata } from "next";

import { PublicForm } from "@/components/public/public-form";
import { createClient } from "@/lib/supabase/server";

async function getFormMetadata(formId: string) {
  const fallback = {
    title: "出店フォームビルダー",
    description: "イベント出店フォームの作成と回答管理ができるツールです。",
  };

  const supabase = await createClient();
  if (!supabase) return fallback;

  const { data } = await supabase
    .from("forms")
    .select("name")
    .eq("id", formId)
    .maybeSingle();

  if (!data?.name) {
    return fallback;
  }

  return {
    title: `${data.name}のフォーム`,
    description: `${data.name}のフォームです。`,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ formId: string }>;
}): Promise<Metadata> {
  const { formId } = await params;
  const metadata = await getFormMetadata(formId);

  return {
    title: metadata.title,
    description: metadata.description,
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      siteName: "出店フォームビルダー",
      locale: "ja_JP",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: metadata.title,
      description: metadata.description,
    },
  };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  return <PublicForm formId={formId} />;
}
