'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    const supabase = createClient()
    const redirectOrigin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectOrigin}/update-password`,
    })
    if (resetError) setError('재설정 이메일을 보내지 못했습니다. 이메일 주소를 확인해주세요.')
    else setMessage('비밀번호 재설정 이메일을 확인해주세요.')
    setLoading(false)
  }

  return <main className="auth-shell"><section className="auth-card"><div className="eyebrow">DAETOX LAND</div><h1>비밀번호 재설정</h1><p>가입한 이메일로 재설정 링크를 보내드립니다.</p><form className="auth-form" onSubmit={handleSubmit}><label>이메일<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" placeholder="이메일 주소" /></label>{error && <div className="auth-error">{error}</div>}{message && <div className="auth-success">{message}</div>}<button type="submit" disabled={loading}>{loading ? '전송 중...' : '재설정 이메일 보내기'}</button><Link className="auth-link" href="/login">로그인으로 돌아가기</Link></form></section></main>
}
