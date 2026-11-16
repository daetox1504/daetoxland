# 기존 HTML → Next.js/React + Supabase 이식 계획

작성일: 2026-11-16  
범위: 분석 및 계획만 작성. 실제 이식 코드는 아직 시작하지 않음.

## 0. 작업 원칙

- 기준 원본은 `docs/reference-html/`로 고정한다.
- `docs/reference-html/`의 HTML, CSS, JavaScript는 수정하지 않는다.
- 기존 Next.js 기능, Supabase 인증, RLS, 환경변수는 삭제하지 않는다.
- 이식 전 별도 브랜치를 생성한다.
- 기존 HTML의 디자인과 동작을 먼저 재현하고, 임의의 재디자인은 하지 않는다.
- 기존 HTML과 Next 결과를 화면별·기능별로 비교한 뒤에만 main 병합 및 Vercel 배포를 진행한다.

권장 브랜치명:

```text
migration/html-parity-20261116
```

## 1. 현재 프로젝트 분석

### 1.1 기술 스택

현재 `next-app/package-lock.json` 기준 버전은 다음과 같다.

| 항목 | 버전 |
|---|---:|
| Next.js | 16.4.6 |
| React | 19.3.1 |
| React DOM | 19.3.1 |
| TypeScript | 7.0.2 |
| `@supabase/supabase-js` | 2.119.0 |
| `@supabase/ssr` | 0.12.7 |

`package.json`에는 대부분 `latest`로 기록되어 있고, 실제 고정 버전은 lock 파일에 있다. 이후 재현성을 위해 이식 완료 후에는 의존성 버전을 명시적으로 고정하는 것을 검토한다.

### 1.2 라우팅 구조

현재 App Router 구조:

```text
next-app/app/
├─ page.tsx                  # 현재 / → /legacy/index.html 리다이렉트
├─ login/page.tsx            # Supabase 이메일/비밀번호 로그인
├─ rentals/page.tsx          # 임대 매물관리
├─ sales/page.tsx            # 매매 매물관리
├─ customers/page.tsx        # 고객장부
├─ briefing/[id]/page.tsx    # 매물 브리핑
├─ components/
│  └─ ManagementShell.tsx    # 임대/매매 공통 관리 화면과 팝업
└─ globals.css               # 전역 CSS
```

현재 `middleware.ts`는 `/`, `/legacy` 경로를 인증 예외로 두고, 나머지 Next 경로에는 Supabase 로그인 세션을 요구한다.

현재 배포 구조는 혼합형이다.

```text
/                 → legacy index.html
/legacy/*         → public/legacy 정적 파일
/rentals          → Next.js
/sales            → Next.js
/customers        → Next.js
/briefing/[id]    → Next.js
```

이 구조는 기존 HTML과 Next 화면이 동시에 존재하여 메뉴·렌더링·데이터 기준이 달라질 수 있다. 이식 완료 후에는 레거시를 비교용으로만 남기고, 실제 운영 진입점은 Next 화면으로 통일하는 것이 최종 목표다.

### 1.3 CSS 방식

- `next-app/app/globals.css` 하나에 전역 스타일과 관리 화면 스타일이 함께 있다.
- `ManagementShell.tsx` 내부에 화면을 직접 생성하는 구조가 있으며, 일부 필터는 별도 React root를 DOM에 삽입한다.
- 현재 스타일에는 기존 수정 과정에서 추가된 보정 CSS가 누적되어 있다.
- 레거시 HTML은 `style.css`를 사용하고, HTML 내부에도 여러 보정 `<style>`과 동적 CSS가 존재한다.

이식 시 CSS는 다음 레이어로 정리한다.

```text
tokens / reset
→ shell / navigation
→ page layout
→ filter / table
→ modal / detail cards
→ briefing / print
→ responsive / print overrides
```

기존 레거시 CSS 값을 먼저 추출한 뒤, 동일한 토큰을 React 화면에서 사용한다.

### 1.4 상태 관리

현재 Next 구현은 별도 전역 상태 라이브러리 없이 각 페이지/컴포넌트의 `useState`, `useEffect`, `useRef`를 사용한다.

- 매물 목록, 선택 항목, 팝업 상태: `ManagementShell` 내부 상태
- 필터 패널: 별도 React root로 마운트되는 `RentalFilterPanel`
- 고객 목록과 고객 팝업: `customers/page.tsx` 내부 상태
- 인증: Supabase Auth 세션
- 필터·관심매물 상태: 현재 페이지 컴포넌트 내부 상태

현재 필터 패널이 별도 React root에 마운트되므로 목록 상태와 동기화가 복잡해질 수 있다. 이식 단계에서는 필터·목록·통계를 같은 페이지 상태 트리 안에서 관리하는 방향으로 정리한다.

### 1.5 데이터 저장

현재 Next는 Supabase를 사용한다.

- `properties`: 임대/매매 매물 공통 테이블
- `customers`: 고객장부
- `activity_logs`: 업무일지·상담일지 연결용
- 매물 상세 확장 필드: `properties.data` JSONB
- 삭제: `deleted_at` 소프트 삭제
- 접근제어: 사용자별 RLS

현재 HTML은 Supabase를 사용하지 않고 `localStorage`에 `sangga-demo-v1` 키로 저장한다. 따라서 기존 브라우저 데이터와 Supabase 데이터는 자동으로 동일하지 않다.

## 2. 기준 HTML 분석

### 2.1 기준 파일

분석 대상:

- `docs/reference-html/index.html`
- `docs/reference-html/rentals.html`
- `docs/reference-html/sales.html`
- `docs/reference-html/customers.html`
- `docs/reference-html/office.html`
- `docs/reference-html/브리핑.html`
- `docs/reference-html/style.css`
- `docs/reference-html/app.js`

### 2.2 공통 화면 구성

레거시 화면은 다음 공통 구조를 사용한다.

1. 좌측 사이드바
   - 대톡스랜드 로고
   - 나의 중개사무소
   - 임대 매물관리
   - 매매 매물관리
   - 고객장부
   - 가상 데이터 안내
2. 상단 breadcrumb와 백업/CSV 메뉴
3. 페이지 제목과 등록 버튼
4. 통계 카드
5. 검색·필터 카드
6. 목록 테이블
7. 페이지네이션
8. 등록/상세 팝업

### 2.3 임대 매물관리

화면 요소:

- 임대매물 수
- 중개중 수
- 관심매물 수
- 매물 찾기 필터
- 임대 매물 목록
- 임대 매물 등록 버튼
- 매물행 클릭 상세 팝업

임대 필터:

- 분류
- 진행상태
- 지역
- 주소
- 전용면적 최소·최대
- 면적 단위: ㎡/평
- 임대층 최소·최대
- 보증금 최소·최대
- 월세 최소·최대
- 관심매물만
- 통합 검색
- 필터 초기화

임대 목록의 주요 열:

- 선택 체크박스
- 관심
- 임대매물번호
- 자체관리번호
- 사진
- 분류/매물명
- 주소
- 층
- 면적
- 금액
- 추천용도
- 일자

### 2.4 매매 매물관리

임대 화면을 기반으로 하지만 데이터와 필터가 다르다.

- 매매가
- 입금가
- 평단가
- 계약면적
- 전용면적
- 임대차 내용
- 계약기간
- 추천용도 필터

매매 필터는 임대 필터와 같은 상태를 공유하면 안 된다. React에서는 `marketType`에 따라 별도 필터 타입과 별도 필터 상태를 사용한다.

### 2.5 고객장부

고객 목록 열:

- 선택
- 상태
- 분류
- 구분
- 고객명
- 전화번호
- 예산
- 수정일

고객 등록/수정 팝업:

- 임대/매매 구분
- 고객명
- 분류
- 전화번호
- 예산
- 상태
- 메모
- 상담일지

고객 행 클릭 시 상세 팝업을 열고, 상담일지는 최신순으로 표시한다.

### 2.6 나의 중개사무소

기존 HTML은 매물·고객·업무 데이터를 기준으로 대시보드를 계산한다.

- 임대 매물 수
- 매매 매물 수
- 전체 관심매물 수
- 진행 중 매물 수
- 고객 수
- 진행상태 분포
- 임대/매매 포트폴리오
- 고객 현황
- 업무일지 수

이 값들은 하드코딩하지 않고 현재 데이터 원본에서 계산해야 한다.

### 2.7 매물 상세 팝업

기존 HTML의 상세 팝업은 다음 카드로 구성된다.

#### 기본정보

- 자체관리
- 추천용도
- 매물명
- 분류
- 진행상태
- 기타
- 고객명
- 전화번호
- 담당자

#### 위치정보

- 메인 사진
- 사진 업로드
- 주소
- 네이버지도 검색 연결

#### 금액정보

임대:

- 보증금
- 월세
- 월세 평단가
- 관리비
- 권리금
- 입금가
- 관리비 부연설명

매매:

- 매매가
- 입금가
- 평단가
- 임대차 내용
- 보증금
- 월세
- 계약기간

#### 임대정보/매물정보

- 층수 시작/종료
- 지상·지하 선택
- 임대면적 또는 계약면적
- 전용면적
- ㎡·평 상호 계산
- 냉난방 또는 냉방
- 가스 또는 난방
- 화장실 또는 방/화장실
- 엘리베이터
- 위반건축물
- 기타

#### 건축물대장

- PDF 업로드
- 지하총층수
- 지상총층수
- 주용도
- 주구조
- 대지면적
- 연면적
- 건축면적
- 엘리베이터
- 주차대수
- 사용승인일
- 층별현황 접기/펼치기

#### 업무일지

- 상담관련 선택
- 업무내용 입력
- 일지 저장
- 최신순 히스토리
- 줄바꿈 유지
- 페이지 또는 고정 높이 목록

### 2.8 건축물대장 PDF/OCR

`app.js`는 다음 순서로 처리한다.

1. PDF.js 로드
2. PDF 텍스트 추출
3. 텍스트가 부족하면 Tesseract.js OCR 실행
4. 층수·용도·구조·면적·승강기·주차대수·사용승인일 추출
5. 층별현황 행 파싱
6. 특정 PDF 형식에 대한 보정 로직 적용

주의할 점:

- OCR 결과는 PDF 품질과 글자 배치에 따라 달라진다.
- 기존 HTML에는 특정 샘플 PDF에 대한 예외 보정이 포함되어 있다.
- 이 예외 보정은 일반 규칙과 별도로 테스트해야 한다.

### 2.9 삭제·휴지통·복구

기존 HTML에는 다음 로직이 있다.

- 현재 필터링 목록 기준 전체 선택
- 개별 선택
- 다중 삭제
- 삭제 확인 팝업
- 소프트 삭제 데이터 저장
- 삭제 직후 되돌리기
- 휴지통 보기
- 휴지통에서 복구
- 영구 삭제 확인
- 삭제 전 원래 배열 위치 저장

React/Supabase에서는 `deleted_at`과 별도 삭제 이력 또는 `data.deletedIndex`를 이용해 동일 동작을 구현한다.

## 3. 기존 HTML과 현재 Next 기능 비교

| 기능 | 기존 HTML | 현재 Next | 상태 |
|---|---|---|---|
| 임대 목록 | 완전 구현 | Supabase 목록 구현 | 부분 이식 |
| 매매 목록 | 완전 구현 | 별도 경로 존재 | 부분 이식 |
| 고객장부 | localStorage 기반 | Supabase 기본 CRUD | 부분 이식 |
| 검색/필터 | 상세 로직 구현 | 일부 구현 | 임대 우선 보완 |
| 관심매물 | 별표 및 필터 | 구현됨 | 동기화 검증 필요 |
| 상세 팝업 | 입력/조회/수정 | 공통 팝업 구현 | 디자인·필드 차이 |
| 사진 업로드 | 브라우저 미리보기 | 파일 input 중심 | Storage 연동 필요 |
| PDF/OCR | PDF.js/Tesseract | 완전 이식 아님 | 추가 이식 필요 |
| 건축물대장 | 필드·층별현황 | 일부 필드 | 보완 필요 |
| 업무일지 | localStorage 배열 | UI 중심 | `activity_logs` 연결 필요 |
| 브리핑 | 3페이지 출력 | 별도 Next 경로 | 레이아웃·분기 보완 |
| 휴지통 | 복구/영구삭제 | 기본 soft delete | 공통화 필요 |
| 대시보드 | 실시간 계산 | 일부 구현 | Supabase 계산으로 통일 필요 |
| 백업/복원 | JSON 백업 | Next 미구현 | 추가 설계 필요 |
| CSV | 목록 export | Next 미구현 | 추가 설계 필요 |

## 4. React 컴포넌트 설계

### 4.1 공통 컴포넌트

```text
AppShell
├─ Sidebar
├─ TopBar
├─ PageHeader
├─ StatsCards
├─ FilterCard
├─ DataTable
├─ BulkActionBar
├─ TrashDialog
├─ ConfirmDialog
└─ DetailModal
```

### 4.2 임대/매매 화면

```text
PropertyManagementPage<MarketType>
├─ PropertyStats
├─ PropertyFilter
├─ PropertyTable
├─ PropertyDetailModal
│  ├─ BasicInfoCard
│  ├─ LocationCard
│  ├─ RentalMoneyCard / SaleMoneyCard
│  ├─ RentalInfoCard / SaleInfoCard
│  ├─ BuildingRegisterCard
│  └─ WorklogCard
├─ PropertyTrashDialog
└─ BriefingLauncher
```

핵심 원칙:

- 임대와 매매는 공통 레이아웃을 재사용한다.
- 필드와 필터 정의는 `marketType`별로 분리한다.
- 임대 필터 상태가 매매 필터에 영향을 주지 않게 한다.
- 상세 팝업은 신규 등록과 기존 수정의 초기값을 분리한다.
- 행 클릭, 체크박스, 별표 클릭 이벤트 영역을 분리한다.

### 4.3 고객 화면

```text
CustomerManagementPage
├─ CustomerFilter
├─ CustomerTable
├─ CustomerDetailModal
│  ├─ CustomerFields
│  ├─ MemoField
│  └─ ConsultationLogPanel
└─ CustomerTrashDialog
```

### 4.4 브리핑

브리핑은 목록 화면과 분리된 프린트 전용 경로로 둔다.

```text
/briefing/[id]
├─ BriefingPage
├─ BriefingPageOne
├─ BriefingPageTwo
├─ BriefingPageThree
└─ PrintButton
```

임대와 매매는 같은 브리핑 프레임을 사용하되, 금액·면적·층 필드의 표시를 `marketType`에 따라 분기한다.

## 5. 데이터 모델 이식 설계

### 5.1 매물

기본 컬럼:

```text
id
user_id
market_type
name
category
address
status
favorite
manager
data
deleted_at
created_at
updated_at
```

`data` JSONB에는 기존 HTML의 확장 필드를 보존한다.

```text
self
recommendation
other
customer
phone
floorFrom
floorTo
floorDetails
leaseM2
leasePyeong
contractM2
contractPyeong
exclusiveM2
exclusivePyeong
deposit
monthlyRent
maintenance
premium
entryPrice
salePrice
unitPrice
saleLeaseNote
contractPeriod
buildingBasement
buildingGround
buildingUse
buildingStructure
landArea
totalArea
buildingArea
buildingElevator
parking
approvalDate
photos
notes
```

### 5.2 고객

현재 `customers` 테이블의 필드를 유지하면서 상담일지는 `activity_logs.customer_id`로 연결한다.

```text
customers
├─ name
├─ market_type
├─ category
├─ phone
├─ budget
├─ status
├─ memo
└─ deleted_at
```

### 5.3 업무일지

기존 HTML의 배열 데이터를 다음 구조로 변환한다.

```text
activity_logs
├─ property_id nullable
├─ customer_id nullable
├─ log_type
├─ content
└─ created_at
```

최신순 조회는 `created_at desc`를 사용한다.

## 6. 저장 방식 비교 및 전환

| 영역 | 기존 HTML | Next 목표 |
|---|---|---|
| 매물/고객 | localStorage | Supabase DB |
| 관심매물 | 객체 boolean | `properties.favorite` |
| 삭제 | 배열 이동 | `deleted_at` soft delete |
| 업무일지 | 객체 내부 배열 | `activity_logs` |
| 사진 | 브라우저 미리보기 | Supabase Storage + URL |
| PDF | 브라우저 임시 분석 | PDF 분석 후 JSON 저장, 원본 보관은 Storage 선택 |
| 백업 | JSON 파일 | DB export/import 설계 필요 |
| 통계 | localStorage 배열 계산 | Supabase 조회 결과 계산 |

기존 브라우저에 있는 `sangga-demo-v1` 데이터는 자동으로 Supabase에 들어가지 않는다. 필요하면 별도 JSON import 기능을 추가한다.

## 7. 예상 문제와 해결 방법

### 7.1 레거시와 Next 라우팅 충돌

문제:

- `/`가 레거시 HTML로 리다이렉트됨
- `public/legacy`와 Next 페이지가 동시에 존재함
- 동일한 메뉴가 서로 다른 데이터 원본을 사용함

해결:

- 이식 완료 전까지 레거시는 비교용으로 유지
- 운영 진입점은 Next로 단일화
- 레거시 스크립트를 Next 화면에서 실행하지 않음

### 7.2 필터 상태 충돌

문제:

- 별도 React root 또는 DOM 삽입식 필터가 목록 상태와 분리됨
- 임대 필터가 매매 화면에 남을 수 있음

해결:

- 필터와 목록을 동일한 React 상태 트리에서 관리
- `RentalFilterState`, `SaleFilterState`를 별도 타입으로 분리
- 적용 시 항상 원본 목록을 기준으로 재계산

### 7.3 클릭 이벤트 충돌

문제:

- 행 클릭과 체크박스/별표 클릭이 동시에 실행될 수 있음
- 기존 HTML에는 누적된 이벤트 가드가 있음

해결:

- 행 클릭은 체크박스, 버튼, 별표 영역을 제외
- 이벤트 위임을 한 곳에서만 사용
- React `onClick`과 document capture listener를 혼용하지 않음

### 7.4 사진 저장

문제:

- 파일 input만으로는 새로고침 후 사진이 유지되지 않음

해결:

- Supabase Storage bucket 생성
- 사용자·매물별 경로 사용
- DB에는 Storage URL과 원본 파일명 저장
- 업로드 실패 시 기존 데이터는 유지

### 7.5 PDF/OCR 성능과 정확도

문제:

- PDF 텍스트가 없으면 OCR이 오래 걸림
- 특정 건축물대장 형식에 따라 필드 위치가 달라짐

해결:

- 먼저 텍스트 추출, 실패 시 OCR fallback
- 분석 중 진행상태 표시
- 파싱 결과를 확인·수정할 수 있게 함
- 특정 파일 예외 보정은 일반 파서와 분리
- 사용승인일과 층별현황을 별도 테스트

### 7.6 인쇄 레이아웃

문제:

- 브라우저 인쇄 배율에 따라 꼬리말이 다음 페이지로 넘어갈 수 있음

해결:

- 브리핑을 프린트 전용 페이지로 분리
- 가로/세로 인쇄 기준을 명시
- `@page`, 고정 페이지 높이, `break-after`를 사용
- 실제 Chrome 인쇄 미리보기에서 1·2·3페이지를 각각 확인

### 7.7 데이터 권한

문제:

- Supabase RLS 때문에 로그인하지 않으면 저장되지 않음
- 기존 HTML은 로그인 없이 동작함

해결:

- Next 운영 화면은 로그인 세션을 기준으로 유지
- 로그인 없는 레거시 화면은 비교 전용으로 한정
- 모든 CRUD 테스트는 인증 사용자 기준으로 수행

## 8. 단계별 작업 순서

### Phase 0 — 보호

- 이식 브랜치 생성
- 현재 main 상태 기록
- 기준 HTML 해시 기록
- 현재 배포본 확인

### Phase 1 — 공통 쉘

- Next의 `/` 진입점 정리
- Sidebar, TopBar, PageHeader 통합
- 레거시 스타일 값을 공통 토큰으로 추출

### Phase 2 — 임대 매물관리

- 기존 HTML과 동일한 필터 배치
- 목록 열과 정렬/페이지네이션
- 관심매물
- 상세 팝업
- 임대 금액/면적/층 필드

### Phase 3 — 건축물대장·사진·업무일지

- PDF 텍스트 추출
- OCR fallback
- 층별현황
- 사진 Storage
- 업무일지 DB 연결

### Phase 4 — 매매 매물관리

- 매매 전용 필드
- 매매 전용 필터
- 매매 전용 상세 팝업
- 매매 브리핑

### Phase 5 — 고객장부

- 고객 등록/수정 팝업
- 고객 상세
- 상담일지
- 고객 삭제/복구/휴지통

### Phase 6 — 대시보드

- 임대/매매/고객 통계 조회
- 하드코딩 제거
- 삭제된 항목 제외

### Phase 7 — 검증

- 디자인 비교
- 기능 체크리스트 실행
- TypeScript 검사
- Next build
- 브라우저 QA
- 인쇄 미리보기 QA

### Phase 8 — 배포

- 브랜치 최종 검토
- 사용자 승인
- main 병합
- GitHub push
- Vercel Preview 확인
- Production 배포

## 9. 검증 체크리스트

### 화면

- [ ] 임대 목록 디자인이 기준 HTML과 일치
- [ ] 매매 목록 디자인이 기준 HTML과 일치
- [ ] 고객장부 디자인이 기준 HTML과 일치
- [ ] 팝업 카드 간격·폰트·버튼 높이 일치
- [ ] 모바일 줄바꿈과 스크롤 확인

### 기능

- [ ] 매물 등록
- [ ] 매물 수정
- [ ] 행 클릭 상세 팝업
- [ ] 관심매물 토글
- [ ] 관심매물 필터
- [ ] 다중 선택 삭제
- [ ] 휴지통
- [ ] 복구
- [ ] 영구 삭제 확인
- [ ] 필터 초기화
- [ ] 검색 Enter
- [ ] 정렬
- [ ] 페이지네이션
- [ ] 고객 등록/수정
- [ ] 상담일지 저장
- [ ] PDF 업로드
- [ ] 사용승인일 추출
- [ ] 층별현황 추출
- [ ] 사진 업로드/재조회
- [ ] 브리핑 출력
- [ ] 인쇄 3페이지 분리

### 데이터

- [ ] 임대와 매매 데이터 분리
- [ ] 고객 데이터 분리
- [ ] 삭제 상태 새로고침 후 유지
- [ ] 관심매물 상태 새로고침 후 유지
- [ ] 대시보드 통계 재계산
- [ ] RLS 사용자별 데이터 분리

## 10. 이번 단계 결과

이번 문서는 분석과 작업 계획만 포함한다. 다음 단계에서 승인 후 브랜치를 만들고, 임대 매물관리부터 기준 HTML과 비교하며 실제 이식을 시작한다.
