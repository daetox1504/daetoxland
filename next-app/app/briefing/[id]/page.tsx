import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '../../components/PrintButton'

export const dynamic = 'force-dynamic'

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: property } = await supabase.from('properties').select('id,name,category,address,status,manager,market_type,data').eq('id', id).is('deleted_at', null).single()
  if (!property) notFound()
  const data = (property.data ?? {}) as Record<string, string>
  const isSale = property.market_type === 'sale'
  return <main className="briefing-page"><div className="briefing-toolbar"><PrintButton /></div><article className="briefing-sheet"><header><div className="eyebrow">PROPERTY BRIEFING</div><h1>{property.name}</h1><p>{property.manager || '담당자 미지정'} · {property.category}</p></header><section className="briefing-top"><div className="briefing-photo">{data.photoUrl ? <img src={data.photoUrl} alt="매물 사진" /> : <span>메인 사진</span>}</div><div className="briefing-facts"><div><small>위치정보</small><strong>{property.address || '주소 미입력'}</strong></div><div><small>층</small><strong>{data.floor || '미입력'}</strong></div><div><small>전용면적</small><strong>{data.exclusiveArea || '미입력'}㎡</strong></div><div><small>{isSale ? '매매가' : '보증금 / 월세'}</small><strong>{isSale ? (data.salePrice || '미입력') : `${data.deposit || '0'} / ${data.monthlyRent || '0'}`}</strong></div></div></section><h2>{isSale ? '매물정보' : '임대정보'}</h2><table><tbody><tr><th>분류</th><td>{property.category}</td><th>상태</th><td>{property.status}</td></tr><tr><th>계약면적</th><td>{data.contractArea || '미입력'}</td><th>{isSale ? '추천용도' : '관리비'}</th><td>{isSale ? (data.recommendation || '미입력') : (data.maintenance || '미입력')}</td></tr><tr><th>{isSale ? '냉방' : '냉난방'}</th><td>{data.cooling || '미입력'}</td><th>{isSale ? '난방' : '가스'}</th><td>{data.heating || '미입력'}</td></tr><tr><th>{isSale ? '방/화장실' : '화장실'}</th><td>{data.roomsBathrooms || '미입력'}</td><th>엘리베이터</th><td>{data.elevator || '미입력'}</td></tr></tbody></table><footer>무단복사 및 배포 시 법적 처벌을 받을 수 있습니다.</footer></article></main>
}
