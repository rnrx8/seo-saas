import { createClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * ファイル名をサニタイズする。日本語・特殊文字を除去しタイムスタンプを付与。
 * @param {string} filename
 * @returns {string}
 */
export function sanitizeFilename(filename) {
  const ext = filename.split('.').pop()
  const safe = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 50)
  return `${Date.now()}_${safe}.${ext}`
}

/**
 * Supabase Storage からファイルをダウンロードしてテキストを抽出する。
 * @param {string} filePath - Storage 内のパス（例: userId/timestamp_file.pdf）
 * @param {string} bucket - バケット名（デフォルト: 'documents'）
 * @returns {Promise<string>}
 */
export async function extractTextFromStorage(filePath, bucket = 'documents') {
  const supabase = getAdminSupabase()
  const { data, error } = await supabase.storage.from(bucket).download(filePath)
  if (error) throw new Error('ファイルのダウンロードに失敗しました: ' + error.message)

  const buffer = Buffer.from(await data.arrayBuffer())
  const ext = filePath.split('.').pop().toLowerCase()
  return extractTextFromBuffer(buffer, ext)
}

/**
 * バッファから拡張子に応じてテキストを抽出する。
 */
export async function extractTextFromBuffer(buffer, ext) {
  if (ext === 'pdf') {
    return extractPdfText(buffer)
  }

  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lines = []
    for (const sheetName of workbook.SheetNames) {
      lines.push(XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]))
    }
    return lines.join('\n')
  }

  if (ext === 'docx') {
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // txt / md / その他テキスト
  return buffer.toString('utf-8')
}

async function extractPdfText(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const uint8Array = new Uint8Array(buffer)
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
  const pdf = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text
}
