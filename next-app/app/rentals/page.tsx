'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type RentalRow = { id: string; name: string; category: string; address: string; status: string; favorite: boolean; manager: string; data: Record<string, unknown> | null; updated_at: string }

export default function RentalsPage() {
  const [rows, setRows] = useState<RentalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadRentals() {
      const supabase = createClient()
      const { data, error: queryError } = await supabase.from('properties').select('id,name,category,address,status,favorite,manager,data,updated_at').eq('market_type', 'rent').is('deleted_at', null).order('updated_at', { ascending: false })
      if (!active) return
      if (queryError) setError('임대 매물을 불러오지 못했습니다. Supabase 정책과 로그인 상태를 확인해주세요.')
      else setRows((data ?? []) as RentalRow[])
      setLoading(false)
    }
    loadRentals()
    return () => { active = false }
  }, [])

  return <div className="shell"><aside className="sidebar"><Link className="brand" href="/">대톡스랜드<small>COMMERCIAL REAL ESTATE</small></Link><div className="nav-title">WORKSPACE</div><nav className="nav"><Link href="/">나의 중개사무소</Link><Link href="/rentals" aria-current="page">임대 매물관리</Link><Link href="/sales">매매 매물관리</Link><Link href="/customers">고객 장부</Link></nav></aside><main className="main management-main"><div className="eyebrow">PROPERTY MANAGEMENT</div><div className="management-heading"><div><h1 className="title">임대 매물관리</h1><p className="description">Supabase에 저장된 임대 매물을 관리합니다.</p></div><button className="primary-button" type="button">+ 임대 매물 등록</button></div><section className="stats-row"><div><span>임대매물</span><strong>{rows.length}</strong></div><div><span>중개중</span><strong>{rows.filter((row) => row.status === '진행').length}</strong></div><div><span>관심매물</span><strong>{rows.filter((row) => row.favorite).length}</strong></div></section><section className="data-panel"><div className="panel-heading"><h2>임대 매물 목록 <b>{rows.length}</b></h2><span>Supabase 실시간 조회</span></div>{loading && <div className="empty-state">임대 매물을 불러오는 중입니다...</div>}{!loading && error && <div className="error-state">{error}</div>}{!loading && !error && rows.length === 0 && <div className="empty-state">등록된 임대 매물이 없습니다. 첫 매물을 등록해보세요.</div>}{!loading && !error && rows.length > 0 && <div className="property-table"><div className="property-table-head"><span>관심</span><span>분류 / 매물명</span><span>주소</span><span>상태</span><span>담당자</span></div>{rows.map((row) => <article className="property-row" key={row.id}><span className={row.favorite ? 'favorite active' : 'favorite'}>★</span><div><small>{row.category}</small><strong>{row.name}</strong></div><span className="address">{row.address || '주소 미입력'}</span><span className="status-pill">{row.status}</span><span>{row.manager || '미지정'}</span></article>)}</div>}</section></main></div>
}
