# 생존수영 트레이너 - 프로젝트 레퍼런스

## 개요
MediaPipe Pose + KNN 분류기를 활용한 실시간 생존수영 동작 학습/연습 웹앱.
정면 카메라(세로)로 앉거나 서서 수행하며, 브라우저에서 ML 추론이 모두 처리됨 (서버 불필요).

---

## 기술 스택
- **프레임워크**: Next.js (App Router)
- **포즈 인식**: @mediapipe/tasks-vision (PoseLandmarker, lite 모델, GPU delegate)
- **분류기**: 자체 구현 KNN (k=5, 유클리드 거리)
- **저장소**: 브라우저 localStorage (서버 저장 없음)
- **스타일링**: globals.css (CSS 변수 기반 다크 테마)

---

## 디렉토리 구조
```
swim-trainer/
├── app/
│   ├── layout.js          # 루트 레이아웃
│   ├── page.js            # 메인 (Trainer 동적 import, SSR 비활성)
│   ├── globals.css        # 전역 스타일 (CSS 변수, 다크 테마)
│   └── admin/
│       └── page.js        # 관리자 페이지 (Admin 동적 import)
├── components/
│   ├── Trainer.jsx        # 메인 컴포넌트 (카메라, 녹화, 연습 UI)
│   └── Admin.jsx          # 관리자 컴포넌트 (데이터 관리)
├── lib/
│   ├── motions.js         # 6대 동작 정의
│   ├── features.js        # MediaPipe 랜드마크 → 특성벡터 추출
│   ├── knn.js             # KNN 분류기 (학습/예측/내보내기/가져오기)
│   └── session.js         # 연습 세션 (시퀀스 추적, 유지시간, 준비자세 감지)
├── package.json
├── next.config.js
└── jsconfig.json          # @/ 경로 별칭
```

---

## 6대 동작 정의 (lib/motions.js)

| # | 이름 | 영문 | 자세 | 유형 | 목표 | 스텝 |
|---|------|------|------|------|------|------|
| 1 | HELP 자세 | 체온 보존 | 앉아서 | hold 30초 | 팔 교차 + 무릎 올리기 | 준비자세 → HELP자세 |
| 2 | 새우등뜨기 | Jellyfish Float | 서서 | hold 20초 | 상체 숙이고 무릎 감싸기 | 준비자세 → 새우등자세 |
| 3 | 구조 신호 | Signal for Help | 앉아서 | 3회 반복 | 한 팔 올려 좌우 흔들기 | 준비자세 → 팔올리기 → 흔들기좌 → 흔들기우 |
| 4 | 스컬링 | Sculling (입영) | 앉아서 | 8회 반복 | 허리높이 팔 벌리기↔모으기 | 준비자세 → 벌리기 → 모으기 |
| 5 | 개헤엄 | Dog Paddle | 앉아서 | 5회 반복 | 팔 뻗기→당기기 | 준비자세 → 뻗기 → 당기기 |
| 6 | 누워뜨기 | Back Float | 서서 | hold 15초 | 양팔 대(大)자 벌리기 | 준비자세 → 대자벌리기 |

### 동작 구분 기준 (MediaPipe 랜드마크)

| 동작 | 머리 | 팔 | 무릎 | 핵심 특성 |
|------|------|-----|------|-----------|
| HELP | 위/뒤 | 가슴에 교차 | 올림 | wrist 교차 + knee 상승 |
| 새우등 | 아래 | 무릎 감싸기 | 굽힘 | nose 하강 + torso 기울기 |
| 구조신호 | 정면 | 한쪽만 위로 흔들기 | 자유 | 한 wrist가 head 위 + 좌우 진동 |
| 스컬링 | 정면 | 허리높이 좌우 | 자유 | 양 wrist 허리~가슴 + 수평 이동 |
| 개헤엄 | 정면 | 교대 상하 | 자유 | wrist 높이 교대 변화 |
| 누워뜨기 | 정면/위 | T자 벌리기 | 자유 | 양 wrist 최대 수평 거리 |

---

## 핵심 파일별 역할

### lib/features.js
- `extractFeatures(landmarks)` → 33개 랜드마크에서 특성벡터 추출
- 입력: MediaPipe PoseLandmarker가 반환하는 landmarks[0] (33개 포인트, 각 {x, y, z, visibility})
- 좌표를 정규화하여 체형/거리에 무관한 상대 벡터로 변환

### lib/knn.js — KNNClassifier
- `addSample(label, features)` — 학습 데이터 추가
- `predict(features)` → `{ label, confidence }` — k=5 최근접 이웃 투표
- `export()` / `import(json)` — JSON 직렬화 (localStorage용)
- `getSampleCounts()` → `{ "준비자세": 12, "HELP자세": 15, ... }`
- `numClasses` — 등록된 클래스 수
- `totalSamples` — 전체 샘플 수
- `clear()` — 전체 초기화

### lib/session.js — PracticeSession
- `constructor(motionId, overrideHoldGoal)` — holdGoal 사용자 설정 가능
- **준비자세 감지 필수**: `readyDetected` 플래그. 준비자세를 먼저 인식해야 동작 카운트/타이머 시작
- **holdMode** (HELP, 새우등, 누워뜨기): 준비자세 → 목표자세 전환 시 타이머 시작. 자세 이탈 시 타이머 정지.
- **시퀀스 모드** (구조신호, 스컬링, 개헤엄): 정의된 순서대로 동작 매칭, cycle 카운트
- 안정화: 최근 8프레임 과반수 투표 + confidence 0.45 이상 필터
- `update(label, confidence, nowSec)` — 매 프레임 호출
- `expected` getter — 다음 기대 동작 (미준비 시 "준비자세" 반환)

### components/Trainer.jsx
- **3가지 모드**: menu → record → practice
- **카메라 제어**: 메뉴에서는 카메라 OFF, 녹화/연습 진입 시 ON
- 모션별 KNN 분류기 6개를 독립 관리 (`classifiersRef.current[1~6]`)
- localStorage 키: `swim_knn_1` ~ `swim_knn_6`
- holdMode 동작은 녹화 패널에서 유지시간 슬라이더(5~60초) 제공
- 키보드: 1~6 동작 선택, SPACE 녹화, ↑↓ 스텝 이동, ESC 메뉴, R 리셋

### components/Admin.jsx
- `/admin` 경로
- 동작별 학습 데이터 통계 (스텝별 샘플 수, 진행 바)
- 전체/개별 JSON 내보내기, 가져오기, 삭제
- localStorage 기반이라는 안내 포함

---

## 데이터 흐름

```
카메라 → MediaPipe PoseLandmarker → landmarks[0] (33점)
    │
    ├─ [녹화 모드] → extractFeatures() → KNN.addSample(stepName, features) → localStorage
    │
    └─ [연습 모드] → extractFeatures() → KNN.predict() → { label, confidence }
                                                              │
                                                    PracticeSession.update()
                                                              │
                                                ┌─ holdMode: 타이머 증가
                                                └─ sequence: 시퀀스 매칭 + 사이클 카운트
```

---

## 현재 한계 / 알려진 이슈

1. **localStorage 기반**: 브라우저/기기 변경 시 데이터 유실. 서버 저장 미구현.
2. **단일 사용자**: 여러 사용자 프로필 구분 없음.
3. **모델 정확도**: KNN이라 학습 데이터 품질에 크게 의존. 최소 스텝당 10~15개 권장.
4. **모바일 최적화**: CSS가 데스크탑 위주. 모바일 레이아웃 개선 필요.
5. **오프라인 미지원**: MediaPipe 모델을 CDN에서 매번 로드.
6. **features.js 검증 필요**: 특성벡터 추출 로직이 6개 동작 구분에 최적인지 미검증.

---

## 실제 생존수영 참고 자료

- 교사용 동작 분석: https://sunkikj.wixsite.com/swimmingforsurvival
- 안전한TV 교육영상: https://www.safetv.go.kr/base/video/view?playlistManagementIdx=8&idx=1240
- HELP 자세: https://en.wikipedia.org/wiki/Heat_escape_lessening_position
- 개헤엄: https://www.enjoy-swimming.com/dog-paddle.html
- 하이닥 기사: https://news.hidoc.co.kr/news/articleView.html?idxno=19358

---

## 실행 방법

```bash
cd swim-trainer
npm install
npm run dev
# http://localhost:3000 (메인)
# http://localhost:3000/admin (관리자)
```

## 의존성 (package.json)

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "@mediapipe/tasks-vision": "^0.10.14"
  }
}
```
