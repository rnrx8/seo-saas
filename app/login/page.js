'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f0f0f8' }}>
      {/* 左：ブランディング */}
      <div className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden px-12">
        {/* ドットグリッド背景 */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, #a78bfa 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* 下部の波形装飾 */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '220px' }}>
          <svg viewBox="0 0 1200 220" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,110 C200,60 400,160 600,90 C800,20 1000,130 1200,80 L1200,220 L0,220 Z" fill="url(#lwave1)" />
            <path d="M0,150 C250,90 500,180 750,120 C950,70 1100,150 1200,120 L1200,220 L0,220 Z" fill="url(#lwave2)" opacity="0.7" />
            <defs>
              <linearGradient id="lwave1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8099e0" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f0b4a4" stopOpacity="0.45" />
              </linearGradient>
              <linearGradient id="lwave2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a0b4ec" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f4c8b8" stopOpacity="0.35" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 text-center">
          <Image src="/logo-circle.png" alt="DIG" width={140} height={140} className="drop-shadow-md" />
          <Image src="/logo-text.png" alt="DiG" width={120} height={60} className="object-contain" />
          <div>
            <p className="text-gray-700 font-semibold text-lg tracking-wide">Understand intent. Unlock growth.</p>
            <p className="text-gray-400 text-sm mt-1">AI-powered deep intent insights for<br />smarter decisions and better outcomes.</p>
          </div>
        </div>
      </div>

      {/* 右：ログインフォーム */}
      <div className="flex flex-col items-center justify-center w-full lg:w-[480px] lg:flex-shrink-0 px-8">
        <div className="glass-panel w-full max-w-sm rounded-2xl shadow-xl p-8">
          {/* スパークアイコン */}
          <div className="text-center mb-6">
            <span className="text-2xl" style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✦</span>
            <h1 className="text-2xl font-bold text-gray-800 mt-2">Welcome back</h1>
            <p className="text-gray-400 text-sm mt-1">Sign in to continue to DIG</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">メールアドレス</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path d="M3 8l9 6 9-6M3 8v10a1 1 0 001 1h16a1 1 0 001-1V8M3 8a1 1 0 011-1h16a1 1 0 011 1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-700 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent placeholder-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">パスワード</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 text-sm text-gray-700 bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent placeholder-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    {showPassword
                      ? <path d="M3 3l18 18M10.5 10.7A3 3 0 0013.3 13.5M6.5 6.6A9.8 9.8 0 003 12c1.7 4 5.5 7 9 7a9.7 9.7 0 005.4-1.6M9 5.1A9.7 9.7 0 0112 5c3.5 0 7.3 3 9 7a10 10 0 01-1.9 3" strokeLinecap="round" strokeLinejoin="round" />
                      : <><path d="M1 12C2.7 7 7 4 12 4s9.3 3 11 8c-1.7 5-6 8-11 8S2.7 17 1 12z" /><circle cx="12" cy="12" r="3" /></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient w-full py-3 rounded-xl text-sm font-medium mt-1 flex items-center justify-center gap-2"
            >
              {loading ? 'ログイン中...' : (
                <>
                  サインイン
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
