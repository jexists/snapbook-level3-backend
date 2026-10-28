# 📷 snapbook — 백엔드 (NestJS)

1인 동네 사진관(마재원 작가님)의 촬영 예약 웹앱 **snapbook**의 API 서버입니다.
"같은 시간에는 한 팀만", "촬영 전날 18시까지만 변경·취소" 같은 예약 규칙을 서버가 지키고,
손님이 쓴 긴 요청 글은 GPT가 요점만 정리해 관리자에게 보여 줍니다.

- 프론트엔드 저장소: [snapbook-level3-frontend](https://github.com/jexists/snapbook-level3-frontend)
- 기획서: [기획서.md](./기획서.md)
- 모든 이름·연락처·예약은 가상 데이터입니다.

> ⏳ **첫 접속이 느릴 수 있어요.**
> 이 서버는 Render 무료 요금제에서 돌아갑니다. 15분 동안 아무도 접속하지 않으면 서버가 잠들고,
> 다음 첫 요청 때 깨어나느라 **30초~1분 정도** 걸릴 수 있습니다. 한 번 깨어나면 그다음부터는 빠릅니다.
> 화면이 멈춘 것처럼 보이면 잠시 기다렸다가 새로고침해 주세요.

## 기술

NestJS 12 · TypeORM · PostgreSQL · JWT 로그인 · OpenAI(GPT) · Vitest

## 로컬에서 실행

```bash
cp .env.example .env   # 값 채우기 (아래 "설정값" 표 참고)
npm install
npm run start:dev      # http://localhost:4100
```

- 처음 켜면 PostgreSQL 안에 이 앱 전용 스키마 `photo_studio`와 테이블 5개를 만듭니다 (`src/database/init.sql`, 여러 번 실행해도 안전). 다른 스키마는 건드리지 않습니다.
- 데이터가 비어 있으면 가상 데이터를 한 번 채우고, 관리자 계정이 없으면 `ADMIN_LOGIN_ID`·`ADMIN_PASSWORD`로 만듭니다. (이미 있으면 비밀번호를 바꾸지 않습니다.)
- `GPT_API_KEY`가 비어 있어도 서버는 정상으로 동작합니다. 이때 AI 요청 정리만 "키 없음"으로 남습니다.

## Render에 배포하기

Render 대시보드 → **New → Web Service** → 이 저장소를 고른 뒤 아래처럼 넣습니다.

| 항목 | 값 |
|---|---|
| Language | `Node` |
| Root Directory | 비워 두기 (저장소 맨 위가 백엔드) |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/health` |
| Instance Type | `Free` |

Node 버전은 `package.json`의 `engines`(24.x)를 따릅니다.

### 설정값 (Environment Variables)

| 이름 | 뜻 | 필수 | 예시 |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL 접속 주소. Render PostgreSQL의 **Internal Database URL**을 넣으면 같은 지역 안에서 빠르게 연결됩니다 | ✅ | `postgresql://user:pw@host/db` |
| `JWT_SECRET` | 로그인 토큰에 서명하는 비밀 문자열. 길고 아무도 모르는 값이면 됩니다 | ✅ | `openssl rand -hex 32` 결과 |
| `ADMIN_LOGIN_ID` | 서버가 처음 켜질 때 만들 관리자 아이디 | ✅ | `admin` |
| `ADMIN_PASSWORD` | 위 관리자 계정의 비밀번호 | ✅ | |
| `FRONTEND_ORIGIN` | 이 API를 불러도 되는 프론트엔드 주소(CORS). 여러 개면 쉼표로 구분, 끝에 `/`는 붙이지 않습니다 | ✅ | `https://snapbook-level3-frontend.vercel.app` |
| `GPT_API_KEY` | OpenAI API 키. 비우면 AI 요청 정리만 꺼집니다 | 선택 | `sk-...` |
| `GPT_MODEL` | 요청 정리에 쓸 GPT 모델 이름 | 선택 | `gpt-5.4-mini` (기본값) |
| `PORT` | 서버 포트. **Render가 알아서 넣어 주므로 넣지 않습니다** | ❌ | |

배포가 끝나면 `https://<서비스이름>.onrender.com/health`에서 `{ "status": "ok", "db": "connected" }`가 보이면 성공입니다.

## 확인

```bash
npm test         # 예약 규칙·가상 데이터 배치 단위 테스트
npm run lint
npm run build
```

`GET /health` → `{ "status": "ok", "db": "connected" }` (DB에 연결하지 못하면 503)

## 구조

```
src/
├─ config/        환경변수 읽기·확인
├─ database/      DB 연결, init.sql(스키마·테이블·시간 겹침 제약)
├─ common/        로그인 확인(@Auth), 공통 오류 형식, 한국 시간 계산, 공통 입력 규칙
└─ modules/
   ├─ health/       DB 연결 확인
   ├─ auth/         손님 가입·로그인, 관리자 로그인 (JWT)
   ├─ customers/    손님 (전화 손님이 나중에 가입하면 기록을 이어 붙임)
   ├─ shoot-types/  촬영 종류 조회(누구나)·관리(관리자)
   ├─ reservations/ 예약 등록·변경·취소, 주간 예약 가능 칸, 관리자 달력·검색·현황
   │                reservation-rules.ts = 기획서 7장 규칙 (단위 테스트 포함)
   ├─ ai-notes/     손님 요청 글 GPT 정리 (이름·번호는 보내지 않음)
   └─ seed/         가상 데이터 다시 채우기
```

규칙은 모두 서버가 지킵니다. 같은 시간에 두 건이 동시에 들어와도 DB 제약(`reservations_no_overlap`)이 한 건만 받습니다.
