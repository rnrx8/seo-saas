import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { remarkBreakTags } from '@/lib/remark-break-tags.mjs'
import { MD_COMPONENTS } from '@/app/_components/ArticleMarkdownComponents'

export const dynamic = 'force-dynamic'

export default async function QualityPreview() {
  // Local acceptance fixture only. Never expose local files in production.
  if (process.env.NODE_ENV !== 'development' || !process.env.QUALITY_ARTICLE_PATH) notFound()
  const artifact = JSON.parse(await readFile(process.env.QUALITY_ARTICLE_PATH, 'utf8'))
  return <main className="w-full max-w-4xl mx-auto p-6 min-w-0 bg-white text-gray-900" data-quality-preview>
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreakTags]} components={MD_COMPONENTS}>{artifact.content_text}</ReactMarkdown>
  </main>
}
