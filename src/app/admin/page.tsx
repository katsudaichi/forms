import { redirect } from "next/navigation";

import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { ConfigNotice } from "@/components/shared/config-notice";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
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

  return <AdminWorkspace mode="home" initialUserEmail={user.email ?? ""} />;
}
