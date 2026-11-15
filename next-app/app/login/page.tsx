'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('이메일 또는 비밀번호를 확인해주세요.')
      setLoading(false)
      return
    }
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">DAETOX LAND</div>
        <h1>로그인</h1>
        <p>중개 업무 공간에 접속하세요.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>이메일<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>비밀번호<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
        </form>
      </section>
    </main>
  )
}
