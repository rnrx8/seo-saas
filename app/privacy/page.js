import Link from 'next/link'

export const metadata = {
  title: 'プライバシーポリシー | SEO記事生成',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <Link href="/" className="text-xl font-bold text-gray-800">SEO記事生成</Link>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">プライバシーポリシー</h1>
        <p className="text-sm text-gray-400 mb-10">最終更新日：2026年4月</p>

        <div className="flex flex-col gap-10 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">1. 収集するデータ</h2>
            <p className="mb-2">本サービスでは、以下のデータを収集・保存します。</p>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-600">
              <li>アカウント情報（メールアドレス）</li>
              <li>入力したキーワード・カテゴリ</li>
              <li>生成した記事・ファクトシート・構成案などの成果物</li>
              <li>アップロードした資料ファイル（一次情報・サービス資料）</li>
              <li>企業設定・CTA・サービス設定などの管理データ</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">2. データの保存場所</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-600">
              <li>すべてのデータはSupabase（米国）のサーバーに保存されます。</li>
              <li>アップロードしたファイルはSupabase Storage（米国）に保存されます。</li>
              <li>各ユーザーのデータは完全に分離されており、他のユーザーからアクセスできない構造になっています。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">3. AIへのデータ送信について</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-600">
              <li>記事生成時に、入力内容をAnthropicのAPIに送信します。</li>
              <li>AnthropicのAPI利用規約により、APIで送信したデータはAIモデルの学習には使用されません（<a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Anthropic プライバシーポリシー</a>）。</li>
              <li>検索データの収集のため、SerpApiに検索キーワードを送信します。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">4. データの利用目的</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-600">
              <li>収集したデータはSEO記事の生成・編集支援のみに使用します。</li>
              <li>第三者へのデータの販売・提供は行いません。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">5. データの削除</h2>
            <ul className="list-disc pl-5 flex flex-col gap-1 text-gray-600">
              <li>設定画面の「アカウントとデータをすべて削除する」からいつでも全データを削除できます。</li>
              <li>アカウント削除時に、生成記事・設定・アップロードファイルを含むすべてのデータが完全に削除されます。</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">6. お問い合わせ</h2>
            <p className="text-gray-600">
              データに関する質問・削除依頼は、設定画面またはメールにてお受けします。
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
