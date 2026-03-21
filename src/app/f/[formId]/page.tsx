import { PublicForm } from "@/components/public/public-form";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  return <PublicForm formId={formId} />;
}
