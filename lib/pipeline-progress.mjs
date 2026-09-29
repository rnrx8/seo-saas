// Ordered to match seo-pipeline/pipeline/step_plan.py. Optional stages can be skipped.
export const PIPELINE_STEPS = [
  { key: 'serp', label: '競合情報の取得' },
  { key: 'search_intent', label: '検索意図の分析' },
  { key: 'fact_sheet', label: '根拠の調査' },
  { key: 'reference_structure', label: '参考構成の確認' },
  { key: 'content_contract', label: '必要項目の整理' },
  { key: 'outline', label: '構成案の作成' },
  { key: 'structure_guard', label: '構成の確認' },
  { key: 'research_validation', label: '根拠・比較条件の確認' },
  { key: 'service_map', label: '紹介位置の調整' },
  { key: 'article', label: '本文の執筆' },
  { key: 'cta_inject', label: '案内リンクの配置' },
  { key: 'review', label: '文章の校閲' },
  { key: 'fact_review', label: '強化ファクトチェック' },
  { key: 'content_audit', label: '内容の検査・修正' },
  { key: 'final_structure_validation', label: '最終確認' },
]
