export function ConfigNotice() {
  return (
    <div className="page-state">
      <div className="onboarding-card">
        <div className="eyebrow">Supabase Required</div>
        <h1>Supabase 環境変数を設定してください</h1>
        <p>
          `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、必要に応じて
          `SUPABASE_SERVICE_ROLE_KEY` を設定すると、この MVP が有効になります。
        </p>
      </div>
    </div>
  );
}
