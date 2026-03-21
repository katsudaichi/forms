"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { ConfigNotice } from "@/components/shared/config-notice";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase 環境変数が未設定です。");
      return;
    }
    setLoading(true);
    setMessage(null);

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo:
                typeof window !== "undefined"
                  ? `${window.location.origin}/admin`
                  : undefined,
            },
          });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup") {
      setMessage(
        "サインアップを受け付けました。メール確認が有効な場合は、届いたリンクを開いてからログインしてください。",
      );
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  if (!isSupabaseConfigured()) {
    return <ConfigNotice />;
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-tag">{mode === "login" ? "Admin Login" : "Create Account"}</div>
        <h1>{mode === "login" ? "管理画面にログイン" : "管理者アカウントを作成"}</h1>
        <p>
          Supabase Auth を使って運営チームのログインを管理します。公開フォームは匿名送信のままです。
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "送信中..." : mode === "login" ? "ログイン" : "サインアップ"}
          </button>
        </form>

        {message ? <div className="auth-message">{message}</div> : null}

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              アカウントが未作成の場合は <Link href="/signup">サインアップ</Link>
            </>
          ) : (
            <>
              既にアカウントがある場合は <Link href="/login">ログイン</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
