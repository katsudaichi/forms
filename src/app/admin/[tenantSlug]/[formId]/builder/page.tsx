import { redirect } from "next/navigation";

import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { ConfigNotice } from "@/components/shared/config-notice";
import { createClient } from "@/lib/supabase/server";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; formId: string }>;
}) {
  const { tenantSlug, formId } = await params;
  const supabase = await createClient();
  if (!supabase) {
    return <ConfigNotice />;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AdminWorkspace
      tenantSlug={tenantSlug}
      formId={formId}
      mode="builder"
      initialUserEmail={user.email ?? ""}
    />
  );
}
