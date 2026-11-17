'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Sidebar, TopBar } from './components/ManagementShell'
import { createClient } from '@/lib/supabase/client'

type PropertyRow = { market_type: string | null; status: string | null; favorite: boolean | null }
type CustomerRow = { status: string | null }
type DashboardData = { properties: PropertyRow[]; customers: CustomerRow[] }

export default function HomePage() {
  const [data, setData] = useState<DashboardData>({ properties: [], customers: [] })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [{ data: properties }, { data: customers }] = await Promise.all([
        supabase.from('properties').select('market_type,status,favorite').is('deleted_at', null),
        supabase.from('customers').select('status').is('deleted_at', null),
      ])
      if (cancelled) return
      setData({ properties: (properties ?? []) as PropertyRow[], customers: (customers ?? []) as CustomerRow[] })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])
  const properties = data.properties
  const rent = properties.filter((row) => row.market_type === 'rent')
  const sale = properties.filter((row) => row.market_type === 'sale')
  const favorites = properties.filter((row) => row.favorite)
  const active = properties.filter((row) => row.status === '진행' || row.status === '중개중')
  const statuses = ['진행', '준비', '상담', '보류', '거래완료']
  const statusCounts = statuses.map((label) => ({ label, value: properties.filter((row) => row.status === label).length }))
  const maxStatus = Math.max(1, ...statusCounts.map((item) => item.value))
  const rentPercent = properties.length ? Math.round((rent.length / properties.length) * 100) : 0
  const customerCount = (status: string) => data.customers.filter((row) => row.status === status).length
  return <div className="shell"><Sidebar /><div className="app"><TopBar /><main className="main dashboard-main">
    <section className="pro-dashboard" aria-label="나의 중개사무소 대시보드"><div className="pro-dashboard-head"><div><div className="pro-kicker">OFFICE OVERVIEW</div><h1>오늘의 중개 현황</h1><p>임대·매매 매물과 고객 흐름을 한 화면에서 관리합니다.</p></div><div className="pro-date">오늘 기준</div></div><div className="pro-kpis"><article><span>전체 매물</span><strong>{loading?'—':properties.length}</strong><small>임대 {rent.length} · 매매 {sale.length}</small></article><article><span>임대 매물</span><strong>{loading?'—':rent.length}</strong><small>진행 {rent.filter(r=>r.status==='진행'||r.status==='중개중').length} · 관심 {rent.filter(r=>r.favorite).length}</small></article><article><span>매매 매물</span><strong>{loading?'—':sale.length}</strong><small>진행 {sale.filter(r=>r.status==='진행'||r.status==='중개중').length} · 관심 {sale.filter(r=>r.favorite).length}</small></article><article><span>관심 매물</span><strong>{loading?'—':favorites.length}</strong><small>임대·매매 합계</small></article><article><span>등록 고객</span><strong>{loading?'—':data.customers.length}</strong><small>고객 장부 기준</small></article></div><div className="pro-grid"><section className="pro-panel"><div className="pro-panel-head"><div><h2>매물 진행 파이프라인</h2><p>전체 매물 {properties.length}건</p></div><span className="pro-total">{properties.length}</span></div><div className="pro-status-list">{statusCounts.map(item=><div className="pro-status-row" key={item.label}><span>{item.label}</span><div><i style={{width:`${item.value/maxStatus*100}%`}}/></div><b>{item.value}</b></div>)}</div></section><section className="pro-panel"><div className="pro-panel-head"><div><h2>임대 · 매매 포트폴리오</h2><p>등록 매물 구성</p></div></div><div className="pro-donut"><div className="pro-donut-ring" style={{['--rent' as string]:`${rentPercent}%`}}><strong>{rentPercent}%</strong><span>임대 비중</span></div><div className="pro-legend"><div><i className="rent"/><span>임대</span><b>{rent.length}건</b></div><div><i className="sale"/><span>매매</span><b>{sale.length}건</b></div></div></div></section><section className="pro-panel pro-customer"><div className="pro-panel-head"><div><h2>고객 관리 현황</h2><p>등록 고객 {data.customers.length}명</p></div><span className="pro-total">{data.customers.length}</span></div><div className="pro-customer-grid"><div><strong>{customerCount('상담중')}</strong><span>상담중</span></div><div><strong>{customerCount('매물안내')}</strong><span>매물안내</span></div><div><strong>{customerCount('종료')}</strong><span>종료</span></div></div><Link className="pro-link" href="/customers">고객 장부 열기 →</Link></section></div></section>
  </main></div></div>
}
