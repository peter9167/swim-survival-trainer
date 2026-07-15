/**
 * 학습 콘텐츠 정의
 * - 유치원~초등 저학년 눈높이로 재구성
 * - 마스코트 "파돌이"(baby dolphin)가 안내
 * - 해변→얕은바다→넓은바다→위험바다→구조까지 5개 존
 * - 이안류/저류/위험지형은 신규 (양양초 문주호 수석 요청)
 * - 아이콘은 icon key (lib/icons.js의 ICONS 참조)
 */

// ═══════════════════════════════════════════════════════════════
// 학습 콘텐츠 (동작이 아닌 이론/안전 콘텐츠)
// motionId(숫자)로 저장되는 동작 상세는 MOTIONS.detailGuide 참고
// ═══════════════════════════════════════════════════════════════
export const LEARN_CONTENT = {
  intro: {
    title: "생존수영이 뭐야?",
    iconKey: "intro",
    zone: "beach",
    mascotLine: "안녕! 나는 파돌이야. 오늘은 바다에서 살아남는 법을 배워보자!",
    intro: "생존수영은 위험한 물에서 내 몸을 지키는 방법이야.",
    sections: [
      {
        heading: "왜 배워야 할까?",
        body: "물에 빠지면 무섭고 힘이 빠져. 그런데 생존수영을 알면 힘을 아끼면서 오래 버틸 수 있어. 구조대가 올 때까지 안전하게 기다릴 수 있게 되는 거야.",
      },
      {
        heading: "무엇을 배울까?",
        items: [
          "물 위에 편하게 뜨는 방법",
          "체온을 지키는 자세",
          "도와달라고 신호 보내는 법",
          "천천히 이동하는 헤엄",
        ],
      },
    ],
  },

  safety: {
    title: "물놀이 안전 약속",
    iconKey: "safety",
    zone: "beach",
    mascotLine: "물에 들어가기 전에 꼭 지켜야 할 약속이 있어!",
    intro: "이 약속만 잘 지켜도 물놀이 사고의 90%를 막을 수 있어.",
    rules: [
      { iconKey: "practice", title: "준비운동 먼저!", desc: "5분 이상 팔·다리·목을 풀어줘." },
      { iconKey: "shallow", title: "혼자 X, 어른과 함께!", desc: "꼭 부모님이나 안전요원이 있는 곳에서만." },
      { iconKey: "warn", title: "밥 먹고 바로 X!", desc: "먹은 뒤 30분은 쉬고 들어가자." },
      { iconKey: "target", title: "얕은 곳부터!", desc: "발이 닿는 곳에서 시작해." },
      { iconKey: "open", title: "구명조끼 착용!", desc: "바다·계곡에선 반드시 착용." },
      { iconKey: "danger", title: "빨간 깃발 = NO!", desc: "빨간 깃발은 '오늘은 위험'이라는 뜻." },
    ],
  },

  cpr: {
    title: "친구를 구했다면?",
    iconKey: "cpr",
    zone: "rescue",
    mascotLine: "친구가 숨을 안 쉰다면? 이렇게 도와줘!",
    intro: "물에서 꺼낸 뒤에도 침착하게 순서를 지키는 게 중요해.",
    steps: [
      { n: 1, title: "119에 전화!", desc: "가장 먼저! 어른에게 알리고 119에 전화해." },
      { n: 2, title: "숨 확인", desc: "가슴이 오르내리는지 5초 동안 봐." },
      { n: 3, title: "가슴 압박 30번", desc: "가슴 가운데를 두 손으로 세게 30번 눌러." },
      { n: 4, title: "인공호흡 2번", desc: "코를 막고 입에 숨을 2번 불어넣어." },
      { n: 5, title: "반복!", desc: "구급대가 올 때까지 반복해." },
    ],
    note: "아이는 어른을 부르는 게 우선이야. 무리해서 혼자 하지 마!",
  },

  rip_current: {
    title: "이안류 (Rip Current)",
    iconKey: "rip_current",
    zone: "danger",
    mascotLine: "바다 밑에는 무서운 강이 흘러! 이름은 '이안류'야.",
    intro:
      "이안류는 해변에서 바다 쪽으로 무섭게 빨려 나가는 강한 물살이야. 눈에 잘 안 보여서 어른도 놓치는 진짜 위험한 흐름이지.",
    sections: [
      {
        heading: "왜 생길까?",
        body: "파도가 계속 해변으로 밀려 들어오면, 밀려온 물이 다시 바다로 돌아가야 하잖아? 그때 좁은 통로로 한꺼번에 빠져나가면서 아주 빠른 강물처럼 흘러. 그게 이안류야.",
      },
      {
        heading: "얼마나 빠를까?",
        body: "이안류는 초당 2m까지 흘러. 이건 올림픽 수영선수도 이길 수 없는 속도야! 그래서 마주 헤엄쳐 나오려고 하면 안 돼.",
      },
      {
        heading: "이렇게 알아봐요",
        items: [
          "다른 곳은 파도가 치는데 그곳만 잔잔해요",
          "물색이 주변보다 어두워요",
          "거품이나 모래가 바다 쪽으로 길게 흘러가요",
          "물결이 해변과 나란히 안 가고 밖으로 흘러요",
        ],
      },
    ],
    scenario: {
      title: "만약 내가 이안류에 빨렸다면?",
      question: "발이 안 닿고 자꾸 바다로 밀려나가고 있어. 어떻게 해야 할까?",
      choices: [
        {
          label: "해변 쪽으로 마주 헤엄쳐!",
          correct: false,
          result:
            "위험해요! 이안류는 너무 빨라서 마주 헤엄치면 힘만 빠지고 지쳐서 가라앉아요. 실제 익수 사고의 가장 큰 이유예요.",
        },
        {
          label: "해변과 나란히(옆으로) 헤엄쳐!",
          correct: true,
          result:
            "정답! 이안류는 폭이 좁아요. 옆으로 몇 미터만 벗어나면 흐름에서 나올 수 있어요. 그다음 해변 쪽으로 헤엄쳐 오는 거예요.",
        },
        {
          label: "물속으로 잠수해서 걸어가!",
          correct: false,
          result:
            "안 돼요! 이안류 아래는 바닥 흐름이 더 세요. 잠수하면 방향을 잃고 더 위험해져요.",
        },
        {
          label: "가만히 뜨면서 손을 흔들어 도움을 요청해!",
          correct: true,
          result:
            "좋은 선택! 힘이 없다면 억지로 헤엄치지 말고 새우등뜨기로 떠 있으면서 구조를 요청하는 것도 정답이에요.",
        },
      ],
    },
    keyPoints: [
      "이안류에서는 절대 마주 헤엄치지 않기",
      "해변과 나란히(옆으로) 빠져나오기",
      "힘들면 뜨기 자세로 체력을 아끼고 도움 요청",
      "빨간 깃발이 있는 해변에는 절대 들어가지 않기",
    ],
  },

  undertow: {
    title: "저류 (Undertow)",
    iconKey: "undertow",
    zone: "danger",
    mascotLine: "바다 바닥에도 몰래 잡아당기는 흐름이 있어!",
    intro:
      "저류는 발 밑, 바닥 쪽에서 몸을 잡아당기는 물의 흐름이야. 파도가 부서지고 다시 바다로 돌아갈 때 바닥을 따라 흘러서 생겨.",
    sections: [
      {
        heading: "이안류랑 뭐가 달라?",
        body: "이안류는 표면에서 바다 쪽으로 나가는 흐름이고, 저류는 발 아래 바닥에서 다리를 잡아당기는 흐름이야. 둘 다 파도 때문에 생기지만 위험한 방식이 조금 달라.",
      },
      {
        heading: "언제 위험할까?",
        items: [
          "파도가 크게 부서지는 해변",
          "모래가 계속 밀려나가는 곳",
          "발이 갑자기 푹 빠지는 자리",
          "허리~가슴 높이 물속에 서 있을 때",
        ],
      },
      {
        heading: "대처 방법",
        body: "저류를 느끼면 다리에 힘을 주고 버티지 말고, 몸을 뒤로 눕히듯 떠서 물살에 몸을 맡겨. 옆으로 헤엄쳐 흐름에서 벗어나면 돼. 무릎 아래에서 느껴진다면 얼른 얕은 곳으로 걸어 나와.",
      },
    ],
    keyPoints: [
      "발이 자꾸 뒤로 밀리면 바로 얕은 곳으로!",
      "억지로 서 있으려 하지 말고 뜨기",
      "저류가 있는 해변은 절대 뛰어들지 않기",
    ],
  },

  terrain: {
    title: "바다 밑 위험 지형",
    iconKey: "terrain",
    zone: "danger",
    mascotLine: "파도가 만든 모래 언덕이 함정이 될 수 있어!",
    intro:
      "파도가 오랫동안 치면 바다 바닥에는 모래가 쌓여서 언덕(모래톱)과 골짜기가 생겨. 이 지형 때문에 갑자기 발이 안 닿는 위험한 순간이 와.",
    sections: [
      {
        heading: "왜 위험할까?",
        body: "얕은 곳(모래톱)을 걸어가다가 갑자기 깊은 골짜기(구덩이)를 만나면 발이 안 닿고 물속으로 미끄러져. 특히 물이 흐린 날엔 어른도 못 봐.",
      },
      {
        heading: "이런 곳을 조심!",
        items: [
          "발 밑이 갑자기 깊어지는 자리",
          "물속에서 모래가 계속 흘러 내리는 곳",
          "파도가 두 갈래로 갈라져서 오는 곳",
          "물색이 갑자기 어두워지는 곳",
        ],
      },
      {
        heading: "안전한 방법",
        body: "허리 위 깊이로는 절대 혼자 가지 마! 물속에서는 한 걸음씩 발끝으로 바닥을 확인하며 걷고, 이상하다 싶으면 바로 뒤로 물러나. 그리고 구명조끼는 언제나 최고의 친구야.",
      },
    ],
    keyPoints: [
      "허리 위 깊이는 어른과 함께 아니면 NO",
      "발끝으로 바닥을 확인하며 걷기",
      "이상한 지형이면 바로 뒤로!",
      "구명조끼는 최고의 방패",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// 학습 경로 (Duolingo-style path)
// 순서대로 하나의 여정처럼 배열. 각 노드는 zone에 속해 있음.
// ═══════════════════════════════════════════════════════════════
export const LEARNING_PATH = [
  // Zone: Beach — 시작
  { type: "content", id: "intro",    zone: "beach",   label: "생존수영이란" },
  { type: "content", id: "safety",   zone: "beach",   label: "안전 약속" },

  // Zone: Shallow — 뜨기
  { type: "motion",  id: 1,          zone: "shallow", label: "HELP 자세" },
  { type: "motion",  id: 2,          zone: "shallow", label: "새우등뜨기" },
  { type: "motion",  id: 6,          zone: "shallow", label: "누워뜨기" },

  // Zone: Open — 움직임/신호
  { type: "motion",  id: 3,          zone: "open",    label: "구조 신호" },
  { type: "motion",  id: 4,          zone: "open",    label: "스컬링" },
  { type: "motion",  id: 5,          zone: "open",    label: "개헤엄" },

  // Zone: Danger — 실전 대응 (신규)
  { type: "content", id: "rip_current", zone: "danger", label: "이안류" },
  { type: "content", id: "undertow",    zone: "danger", label: "저류" },
  { type: "content", id: "terrain",     zone: "danger", label: "바다 지형" },

  // Zone: Rescue — 응급
  { type: "content", id: "cpr",         zone: "rescue", label: "심폐소생술" },
];

// 존 메타 (색상/이름)
export const ZONES = {
  beach:   { name: "해변마을",  desc: "여기서부터 출발!",       color: "#fbbf24", accent: "#f59e0b" },
  shallow: { name: "얕은바다",  desc: "떠 있는 자세 배우기",    color: "#22d3ee", accent: "#0ea5e9" },
  open:    { name: "넓은바다",  desc: "움직이고 신호 보내기",   color: "#3b82f6", accent: "#1d4ed8" },
  danger:  { name: "위험바다",  desc: "진짜 바다의 함정",       color: "#fb7185", accent: "#e11d48" },
  rescue:  { name: "구조본부",  desc: "친구를 구하는 방법",     color: "#f97316", accent: "#ea580c" },
};

// 노드 → 아이콘 키 매핑
export function nodeIconKey(node) {
  if (node.type === "motion") return `motion_${node.id}`;
  return node.id; // content id가 곧 iconKey
}

export const MASCOT_NAME = "파돌이";
