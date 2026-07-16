# scripts/

프로젝트 관련 자동화 스크립트.

## screenshots.mjs — 자동 스크린샷 캡처

`docs/SETUP_GUIDE.html`에 넣을 스크린샷을 Playwright로 자동 캡처합니다.

### 사전 준비

1. Playwright 브라우저 다운로드 (한 번만):
   ```bash
   npx playwright install chromium
   ```

2. `ROOT_CREDENTIALS.md`가 프로젝트 루트에 있어야 함 (로그인 필요 스크린샷용).
   없으면 로그인 스크린샷은 자동 스킵.

### 실행

```bash
# 터미널 1: 개발 서버 실행 (계속 유지)
npm run dev

# 터미널 2: 스크린샷 캡처
npm run screenshots
```

결과: **`docs/screenshots/*.png`** 에 12장 정도 저장됨.

### 캡처되는 화면 목록

| 파일 | 화면 |
|---|---|
| `01-practice-motion-select.png` | 연습 탭 — 동작 선택 |
| `02-learn-ocean-path.png` | 학습 탭 — 오션 어드벤처 맵 |
| `02b-learn-ocean-path-full.png` | 학습 탭 (전체 세로 스크롤) |
| `03-learn-rip-current.png` | 학습 — 이안류 상세 (시나리오 퀴즈 포함) |
| `04-settings-logged-out.png` | 설정 탭 (로그아웃 상태) |
| `05-login-modal.png` | 관리자 로그인 모달 |
| `06-settings-account-root.png` | 설정 → 내 계정 (root 로그인 상태) |
| `07-admin-management.png` | 관리자 관리 목록 |
| `07b-admin-passwords-revealed.png` | 관리자 비밀번호 노출 상태 |
| `08-settings-schools.png` | 학교 관리 탭 |
| `08b-schools-list.png` | 학교 계정 목록 |
| `09-settings-data.png` | 데이터 관리 탭 |
| `10-settings-device.png` | 기기 설정 탭 |
| `11-tablet-learn.png` | 태블릿 세로 — 학습 |
| `12-tablet-practice.png` | 태블릿 세로 — 연습 |

### 환경 변수 (선택)

| 변수 | 기본값 | 설명 |
|---|---|---|
| `SWIM_URL` | `http://localhost:3000` | 캡처 대상 URL |
| `SWIM_ROOT_USER` | `root` | 로그인 아이디 |
| `SWIM_ROOT_PASSWORD` | (파일에서 자동 파싱) | root 비밀번호 |

프로덕션 URL을 캡처하려면:
```bash
SWIM_URL=https://swim-survival-trainer.vercel.app npm run screenshots
```

### 가이드에 삽입

캡처 완료 후 `docs/SETUP_GUIDE.html`을 열어 원하는 위치에:

```html
<img src="screenshots/01-practice-motion-select.png"
     alt="연습 탭 동작 선택 화면"
     style="width: 100%; border-radius: 8px; margin: 12px 0;">
```

이 형식으로 삽입. HTML을 브라우저에서 열어 확인 → `Ctrl+P` → PDF로 저장.

### 카메라·pose detection 관련

이 스크립트는 Chromium을 `--use-fake-device-for-media-stream` 플래그로 실행합니다.
- 카메라 권한은 자동 허용됨
- 하지만 fake camera라 실제 pose detection은 안 됨
- "카메라 위치를 확인하세요" 상태까지는 캡처 가능
- 실제 스켈레톤 오버레이·feedback 스크린샷은 수동 캡처 필요

### 문제 해결

- **"waitFor timeout"**: 개발 서버가 안 켜졌거나 응답이 느림. `npm run dev` 확인.
- **로그인 실패**: `ROOT_CREDENTIALS.md`의 비밀번호가 실제 DB와 다름. 확인 후 재실행.
- **빈 학교 목록**: Supabase에 아직 학교가 없음. 데이터 넣고 재캡처.
