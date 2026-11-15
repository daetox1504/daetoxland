import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata={title:'대톡스랜드 · 상가 매물 장부',description:'임대·매매 매물과 고객을 관리하는 중개 업무 공간'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
