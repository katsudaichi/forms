import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="eyebrow">Supabase MVP</div>
        <h1>イベント出店フォームと運営管理をひとつにまとめる。</h1>
        <p>
          `codex_prompt.md` の構成と `prototypes` の画面意図を再構成し、認証・フォーム収集・回答管理・投稿文/画像テンプレート設定を一体化した MVP です。
        </p>
        <div className="landing-actions">
          <Link href="/signup">管理者アカウント作成</Link>
          <Link href="/login" className="secondary">
            ログイン
          </Link>
        </div>
      </section>
    </main>
  );
}
