# 대톡스랜드 Next.js 전환본

기존 정적 프로토타입은 상위 폴더에 보존하고, 이 폴더에서 `Next.js + TypeScript + Supabase` 전환을 진행합니다.

```bash
npm install
copy .env.example .env.local
npm run dev
```

## Vercel 배포

이 폴더가 독립적인 Next.js 앱이므로 GitHub 저장소를 Vercel에 연결할 때
**Root Directory를 `next-app`**으로 지정합니다.

Vercel 환경 변수에는 Supabase 프로젝트의 다음 값만 등록합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

`SUPABASE_SECRET_KEY`나 `SUPABASE_SERVICE_ROLE_KEY` 같은 서버 비밀키는
`NEXT_PUBLIC_` 접두사를 붙이거나 저장소에 커밋하지 않습니다.

로컬 검증:

```bash
npm run build
```
