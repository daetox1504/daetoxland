'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    async function prepare() {
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError && active) setError('재설정 링크가 만료되었거나 이미 사용되었습니다.')
      }
      const { data } = await supabase.auth.getSession()
      if (active && data.session) setReady(true)
      else if (active && !code) setError('재설정 링크를 통해 이 페이지를 열어주세요.')
    }
    prepare()
    return () => { active = false }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 6) { setError('비밀번호는 6자 이상 입력해주세요.'); return }
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) { setError('비밀번호를 변경하지 못했습니다. 재설정 링크를 다시 요청해주세요.'); setLoading(false); return }
    await supabase.auth.signOut()
    router.replace('/login?reset=success')
  }

  return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">DAETOX LAND</div><h1>새 비밀번호 설정</h1><p>새 비밀번호를 입력하면 재설정이 완료됩니다.</p>{ready ? <form className="auth-form" onSubmit={handleSubmit}><label>새 비밀번호<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" /></label><label>새 비밀번호 확인<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} required minLength={6} autoComplete="new-password" /></label>{error && <div className="auth-error">{error}</div>}<button type="submit" disabled={loading}>{loading ? '변경 중...' : '비밀번호 변경'}</button></form> : <div className={error ? 'auth-error' : 'auth-loading'}>{error || '재설정 링크를 확인하는 중입니다...'}</div>}{!ready && error && <Link className="auth-link" href="/forgot-password">재설정 이메일 다시 보내기</Link>}</section></main>
}
