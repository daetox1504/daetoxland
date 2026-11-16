'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Sidebar, TopBar } from './components/ManagementShell'
import { createClient } from '@/lib/supabase/client'

type DashboardCounts = { rent: number; sale: number; activeRent: number; activeSale: number; favorites: number; customers: number }
const emptyCounts: DashboardCounts = { rent: 0, sale: 0, activeRent: 0, activeSale: 0, favorites: 0, customers: 0 }

export default function HomePage() {
  const [counts, setCounts] = useState<DashboardCounts>(emptyCounts)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [{ data: properties }, { data: customers }] = await Promise.all([
        supabase.from('properties').select('market_type,status,favorite').is('deleted_at', null),
        supabase.from('customers').select('id').is('deleted_at', null),
      ])
      if (cancelled) return
      const rows = properties ?? []
      const rent = rows.filter((row) => row.market_type === 'rent')
      const sale = rows.filter((row) => row.market_type === 'sale')
      setCounts({ rent: rent.length, sale: sale.length, activeRent: rent.filter((row) => row.status === '진행').length, activeSale: sale.filter((row) => row.status === '진행').length, favorites: rows.filter((row) => row.favorite).length, customers: customers?.length ?? 0 })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])
  const total = counts.rent + counts.sale
  return <div className="shell"><Sidebar /><div className="app"><TopBar /><main className="main dashboard-main">
    <div className="eyebrow">OFFICE OVERVIEW</div>
    <div className="management-heading"><div><h1 className="title">나의 중개사무소</h1><p className="description">임대·매매 매물과 고객 현황을 한눈에 확인하세요.</p></div></div>
    <section className="dashboard-stats stats-row" aria-label="중개 현황">
      <div><span>전체 매물</span><strong>{loading ? '—' : total}</strong><small>임대 {counts.rent} · 매매 {counts.sale}</small></div>
      <div><span>임대 매물</span><strong>{loading ? '—' : counts.rent}</strong><small>중개중 {counts.activeRent}</small></div>
      <div><span>매매 매물</span><strong>{loading ? '—' : counts.sale}</strong><small>중개중 {counts.activeSale}</small></div>
      <div><span>관심 매물</span><strong>{loading ? '—' : counts.favorites}</strong><small>임대·매매 합계</small></div>
      <div><span>등록 고객</span><strong>{loading ? '—' : counts.customers}</strong><small>고객 장부 기준</small></div>
    </section>
    <section className="dashboard-panels">
      <article className="dashboard-panel"><div><span className="panel-kicker">RENTAL MANAGEMENT</span><h2>임대 매물관리</h2><p>임대 매물 목록과 필터, 상세 정보를 관리합니다.</p></div><Link className="link" href="/rentals">임대 매물관리 열기 →</Link></article>
      <article className="dashboard-panel"><div><span className="panel-kicker">SALES MANAGEMENT</span><h2>매매 매물관리</h2><p>매매 매물 목록과 매물 상세 정보를 관리합니다.</p></div><Link className="link" href="/sales">매매 매물관리 열기 →</Link></article>
      <article className="dashboard-panel"><div><span className="panel-kicker">CUSTOMER MANAGEMENT</span><h2>고객 장부</h2><p>고객 정보와 상담 상태를 관리합니다.</p></div><Link className="link" href="/customers">고객 장부 열기 →</Link></article>
    </section>
  </main></div></div>
}
