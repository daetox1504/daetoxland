'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from './components/ManagementShell'

export default function DashboardPage() {
  const [stats, setStats] = useState({ rent: 0, sale: 0, active: 0, favorite: 0, customers: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => { async function load() { const supabase = createClient(); const [rent, sale, active, favorite, customers] = await Promise.all([supabase.from('properties').select('id', { count: 'exact', head: true }).eq('market_type', 'rent').is('deleted_at', null), supabase.from('properties').select('id', { count: 'exact', head: true }).eq('market_type', 'sale').is('deleted_at', null), supabase.from('properties').select('id', { count: 'exact', head: true }).eq('status', '진행').is('deleted_at', null), supabase.from('properties').select('id', { count: 'exact', head: true }).eq('favorite', true).is('deleted_at', null), supabase.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null)]); setStats({ rent: rent.count ?? 0, sale: sale.count ?? 0, active: active.count ?? 0, favorite: favorite.count ?? 0, customers: customers.count ?? 0 }); setLoading(false) } load() }, [])
  return <div className="shell"><Sidebar /><main className="main management-main"><div className="eyebrow">OFFICE OVERVIEW</div><div className="management-heading"><div><h1 className="title">나의 중개사무소</h1><p className="description">임대·매매 매물과 고객 현황을 한눈에 확인하세요.</p></div></div><section className="stats-row dashboard-stats"><div><span>임대매물</span><strong>{loading ? '—' : stats.rent}</strong><small>등록된 임대 매물</small></div><div><span>매매매물</span><strong>{loading ? '—' : stats.sale}</strong><small>등록된 매매 매물</small></div><div><span>중개중</span><strong>{loading ? '—' : stats.active}</strong><small>현재 진행 중인 매물</small></div><div><span>관심매물</span><strong>{loading ? '—' : stats.favorite}</strong><small>관심 표시된 매물</small></div><div><span>고객</span><strong>{loading ? '—' : stats.customers}</strong><small>삭제되지 않은 고객</small></div></section><section className="cards"><article className="card"><h2>임대 매물관리</h2><p>보증금·월세·임대층을 기준으로 관리합니다.</p><Link className="link" href="/rentals">페이지 열기 →</Link></article><article className="card"><h2>매매 매물관리</h2><p>매매가·계약면적·추천용도를 관리합니다.</p><Link className="link" href="/sales">페이지 열기 →</Link></article><article className="card"><h2>고객장부</h2><p>고객 정보와 상담 상태를 관리합니다.</p><Link className="link" href="/customers">페이지 열기 →</Link></article></section></main></div>
}
