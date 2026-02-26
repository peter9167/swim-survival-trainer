/**
 * 생존수영 6대 동작 정의
 * - 정면 카메라 (세로) + 앉거나 서서 수행
 * - MediaPipe 랜드마크로 구분 가능한 동작만 포함
 *
 * holdMode: 자세를 일정 시간 유지하는 동작 (시간 기반 판정)
 * sequence: 반복 사이클 동작 (시퀀스 매칭 판정)
 *
 * posture: "seated" | "standing" — UI 안내용
 */
export const MOTIONS = {
  1: {
    name: "HELP 자세",
    sub: "체온 보존",
    desc: "팔짱 + 무릎 끌어올려 30초 유지",
    guide: "앉아서 팔을 가슴에 교차하고, 무릎을 가슴 쪽으로 끌어올리세요.",
    posture: "seated",
    steps: ["준비자세", "HELP자세"],
    sequence: ["HELP자세"],
    targetCycles: 1,
    holdMode: true,
    holdGoal: 30,
    icon: "🔥",
  },
  2: {
    name: "새우등뜨기",
    sub: "Jellyfish Float",
    desc: "웅크려 떠있기 자세 20초 유지",
    guide:
      "일어서서 상체를 앞으로 숙이고, 양손으로 무릎/정강이를 감싸 안으세요. 머리를 아래로 숙이세요.",
    posture: "standing",
    steps: ["준비자세", "새우등자세"],
    sequence: ["새우등자세"],
    targetCycles: 1,
    holdMode: true,
    holdGoal: 20,
    icon: "🦐",
  },
  3: {
    name: "구조 신호",
    sub: "Signal for Help",
    desc: "한 팔 올려 좌우 흔들기",
    guide:
      "한쪽 팔을 머리 위로 높이 올린 뒤, 좌우로 크게 흔들어 구조 신호를 보내세요.",
    posture: "seated",
    steps: ["준비자세", "팔올리기", "흔들기좌", "흔들기우"],
    sequence: ["팔올리기", "흔들기좌", "흔들기우"],
    targetCycles: 3,
    icon: "🆘",
  },
  4: {
    name: "스컬링",
    sub: "Sculling (입영)",
    desc: "허리높이 팔 8자 젓기",
    guide:
      "양 팔을 허리~가슴 높이에서 바깥으로 벌렸다가 안으로 모으는 동작을 반복하세요.",
    posture: "seated",
    steps: ["준비자세", "벌리기", "모으기"],
    sequence: ["벌리기", "모으기"],
    targetCycles: 8,
    icon: "💧",
  },
  5: {
    name: "개헤엄",
    sub: "Dog Paddle",
    desc: "팔 뻗기→당기기 반복",
    guide:
      "양팔을 앞으로 뻗었다가 아래로 당기는 동작을 교대로 반복하세요. 물을 밀어내는 느낌으로!",
    posture: "seated",
    steps: ["준비자세", "뻗기", "당기기"],
    sequence: ["뻗기", "당기기"],
    targetCycles: 5,
    icon: "🏊",
  },
  6: {
    name: "누워뜨기",
    sub: "Back Float",
    desc: "양팔 대(大)자 벌리기 15초 유지",
    guide:
      "일어서서 양팔을 어깨 높이로 옆으로 크게 벌리세요. 손바닥은 위를 향하게!",
    posture: "standing",
    steps: ["준비자세", "대자벌리기"],
    sequence: ["대자벌리기"],
    targetCycles: 1,
    holdMode: true,
    holdGoal: 15,
    icon: "🌊",
  },
};
