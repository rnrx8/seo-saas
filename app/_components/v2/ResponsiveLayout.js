'use client'

import { useEffect, useId, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function ResponsiveLayout({ children, sidebar, dark = false }) {
  const menuRef = useRef(null)
  const menuId = useId()
  const pathname = usePathname()

  useEffect(() => {
    menuRef.current?.close()
  }, [pathname])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => {
      if (desktop.matches) menuRef.current?.close()
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden lg:flex-row" style={dark ? { backgroundColor: '#eef2f8' } : undefined}>
      <div className="hidden shrink-0 lg:block">{sidebar}</div>
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => menuRef.current?.showModal()}
          aria-haspopup="dialog"
          aria-controls={menuId}
          className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
          メニュー
        </button>
        <span className="text-sm font-bold text-gray-700">DIG</span>
      </header>
      <dialog
        ref={menuRef}
        id={menuId}
        aria-label="ナビゲーションメニュー"
        className="m-0 h-dvh max-h-dvh w-72 max-w-[90vw] border-0 bg-white p-0 text-gray-700 shadow-xl backdrop:bg-black/40"
        onClick={event => {
          if (event.target === event.currentTarget || event.target.closest('a')) menuRef.current?.close()
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 justify-end border-b border-gray-100 p-2">
            <button type="button" onClick={() => menuRef.current?.close()} className="min-h-11 rounded-lg px-4 text-sm hover:bg-gray-100">
              メニューを閉じる
            </button>
          </div>
          <div className="min-h-0 flex-1 [&>aside]:h-full [&>aside]:w-full">{sidebar}</div>
        </div>
      </dialog>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
