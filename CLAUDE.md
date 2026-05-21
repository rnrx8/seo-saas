@AGENTS.md

# プロジェクト概要

**スタック**: Next.js (Vercel) + FastAPI (Railway) + Supabase

## ディレクトリ構成

```
app/
  api/          # Next.js Route Handlers（バックエンドAPIはRailwayのFastAPIへプロキシ）
  _components/  # 共通UIコンポーネント（v2/以下が現行版）
  _lib/         # フロントエンド共通ロジック（feature-flag.js等）
  dashboard/    # ダッシュボード画面
  article/[id]/ # 記事詳細画面
  settings/     # 設定画面群（companies, services, sources, ctas）
  login/        # 認証画面
lib/
  supabase.js   # Supabaseクライアントシングルトン
.github/
  workflows/    # GitHub Actions
```

## 主要な環境変数

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase接続
- `PIPELINE_API_URL` — Railway上のFastAPI（記事生成パイプライン）

## ビルド・開発コマンド

```bash
npm run dev    # 開発サーバー起動（localhost:3000）
npm run build  # 本番ビルド
npm run lint   # ESLintチェック
```

## 自動修正時のルール

- **変更は小さく安全に。** 確信が持てない箇所はPR説明に必ず明記する
- **Supabase RLS**: INSERT時は `with check (auth.uid() = tenant_id)` が必須。`tenant_id` は `supabase.auth.getUser()` から明示的にセットする。テナント分離を壊す変更は禁止
- **UIの自動化禁止**: フル自動化よりユーザーコントロールを優先する設計方針を尊重し、既存のUIを勝手に自動化仕様に作り替えない
- **シンプルさ優先**: 複雑な回避策より単純で読みやすい実装を選ぶ
