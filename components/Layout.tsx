'use client'

import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function Layout({ children }: { children: React.ReactNode }) {
  // Prevent execution explicitly if env vars are missing during build, although our client.ts tries to handle this.
  // We use a safe initialization via the imported createClient which now has fallbacks.
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedAuth, setCheckedAuth] = useState(false)

  // ✅ Hide sidebar CHỈ ở đúng trang làm bài: /tests/[id]
  // - segments = ["tests", "<id>"]
  // - loại "manage"
  // Safe check for pathname (can be null during some prerender contexts)
  const segments = pathname ? pathname.split('/').filter(Boolean) : []
  const hideSidebar =
    segments[0] === 'tests' && segments.length === 2 && segments[1] !== 'manage'

  async function updateRole() {
    // If using dummy/fallback URL (during build), skip auth check
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!supabaseUrl || supabaseUrl.includes('example.com')) {
      setCheckedAuth(true); // Allow render to proceed
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Danh sách các trang public không cần login
    // 1. /login
    // 2. /tests/[id] (làm bài thi)
    const isPublic =
      pathname === '/login' || (segments[0] === 'tests' && segments.length === 2 && segments[1] !== 'manage')

    if (!user) {
      // Nếu không phải trang public thì mới đá về login
      if (!isPublic) {
        setIsAdmin(false)
        setCheckedAuth(true)
        router.push('/login')
        return
      }

      // Nếu là trang public thì cho qua (với quyền guest)
      setIsAdmin(false)
      setCheckedAuth(true)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    setIsAdmin(profile?.role === 'admin')
    setCheckedAuth(true)
  }

  useEffect(() => {
    updateRole()

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      updateRole()
    })

    return () => {
      listener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!checkedAuth) return null

  // ✅ Trang làm bài: không sidebar
  if (hideSidebar) {
    return <div className="min-h-screen bg-gray-900 text-white">{children}</div>
  }

  // ✅ Các trang khác (reports, manage, questions...) vẫn có sidebar
  return (
    <div className="min-h-screen flex bg-white text-gray-900">
      <aside className="w-64 bg-slate-900 text-white p-6">
        <h1 className="text-2xl font-bold mb-8 text-[var(--primary)]">Test Center</h1>

        <nav className="space-y-2">
          {isAdmin && (
            <>
              <Link
                href="/tests/manage"
                className="block px-3 py-2 rounded-md text-white/90 hover:text-white hover:bg-white/10 transition"
              >
                Quản lý bài test
              </Link>

              <Link
                href="/reports"
                className="block px-3 py-2 rounded-md text-white/90 hover:text-white hover:bg-white/10 transition"
              >
                Báo cáo
              </Link>
            </>
          )}

          <div className="my-4 border-t border-white/10" />

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="block w-full text-left px-3 py-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            Đăng xuất
          </button>
        </nav>
      </aside>


      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
