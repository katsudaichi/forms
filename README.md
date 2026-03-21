# Event Booth Studio MVP

イベント出店フォームと管理ツールの MVP です。Next.js + Supabase で動作します。

## 主な機能

- 管理者サインアップ / ログイン
- テナント作成
- 出店フォームビルダー
- 公開フォームからの回答送信
- 回答一覧と画像付き回答の確認
- 画像合成設定
- 投稿文設定

## 必要な環境変数

`.env.local` に以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

現状の MVP では `SUPABASE_SERVICE_ROLE_KEY` は未使用です。

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. `.env.local` を作成

```bash
cp .env.example .env.local
```

3. Supabase の migration を適用

- `supabase/migrations/001_initial.sql`
- `supabase/migrations/002_public_submission_and_assets.sql`

4. 開発サーバーを起動

```bash
npm run dev
```

5. 本番ビルド確認

```bash
npm run build
```

## 現在の運用メモ

- 公開フォームの匿名回答確認のため、`public.responses` の RLS は一時的に無効化して運用しています
- 本番化の前に `responses` の policy は締め直す前提です

## デプロイ

GitHub に push 後、Vercel でこのリポジトリを import してください。

Vercel 側で設定する環境変数:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## ディレクトリ

- `src/app`: App Router の画面
- `src/components`: 管理画面 / 公開フォーム / 共通 UI
- `src/lib`: 型、初期値、Supabase クライアント
- `supabase/migrations`: DB 初期化と policy 修正 SQL
