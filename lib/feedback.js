/**
 * 규칙 기반 자세 피드백 시스템
 * MediaPipe 랜드마크를 분석하여 각 동작의 체크포인트를 검사하고 피드백 제공
 *
 * MediaPipe 랜드마크 인덱스:
 * 0: 코(nose)
 * 11: 왼어깨  12: 오른어깨
 * 13: 왼팔꿈치  14: 오른팔꿈치
 * 15: 왼손목  16: 오른손목
 * 23: 왼엉덩이  24: 오른엉덩이
 * 25: 왼무릎  26: 오른무릎
 * 27: 왼발목  28: 오른발목
 */

// 유틸리티 함수들
function getPoint(landmarks, idx) {
  const lm = landmarks[idx];
  return { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
}

function distance2D(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function distance3D(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
}

function midpoint(p1, p2) {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
  };
}

function angle3D(a, b, c) {
  // b를 꼭짓점으로 하는 각도 계산
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magA = Math.hypot(ba.x, ba.y, ba.z) || 0.001;
  const magC = Math.hypot(bc.x, bc.y, bc.z) || 0.001;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

// 어깨 너비 계산 (정규화 기준)
function getShoulderWidth(landmarks) {
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  return distance2D(leftShoulder, rightShoulder) || 0.001;
}

// 흔들기 감지를 위한 히스토리 관리 클래스
export class FeedbackHistory {
  constructor(maxFrames = 15) {
    this.maxFrames = maxFrames;
    this.history = [];
  }

  add(landmarks) {
    this.history.push({
      timestamp: Date.now(),
      landmarks: landmarks,
    });
    if (this.history.length > this.maxFrames) {
      this.history.shift();
    }
  }

  // 특정 랜드마크의 x좌표 변화량 계산 (흔들기 감지용)
  getXMovement(landmarkIdx) {
    if (this.history.length < 5) return 0;
    const positions = this.history.map((h) => h.landmarks[landmarkIdx].x);
    let totalMovement = 0;
    for (let i = 1; i < positions.length; i++) {
      totalMovement += Math.abs(positions[i] - positions[i - 1]);
    }
    return totalMovement;
  }

  // 양손목 간 거리 변화량 계산 (스컬링 감지용)
  getWristDistanceChange() {
    if (this.history.length < 5) return { min: 0, max: 0, range: 0 };
    const distances = this.history.map((h) => {
      const left = h.landmarks[15];
      const right = h.landmarks[16];
      return Math.hypot(left.x - right.x, left.y - right.y);
    });
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    return { min, max, range: max - min };
  }

  // 양손목 y좌표 차이의 변화 (개헤엄 교대 감지용)
  getWristAlternation() {
    if (this.history.length < 8) return 0;
    const diffs = this.history.map((h) => {
      const left = h.landmarks[15];
      const right = h.landmarks[16];
      return left.y - right.y;
    });
    // 부호가 바뀐 횟수 카운트
    let alternations = 0;
    for (let i = 1; i < diffs.length; i++) {
      if ((diffs[i] > 0 && diffs[i - 1] < 0) || (diffs[i] < 0 && diffs[i - 1] > 0)) {
        alternations++;
      }
    }
    return alternations;
  }

  clear() {
    this.history = [];
  }
}

/**
 * 동작별 피드백 평가 함수
 * @param {number} motionId - 동작 ID (1-6)
 * @param {Array} landmarks - MediaPipe 33개 랜드마크
 * @param {FeedbackHistory} history - 프레임 히스토리 (동적 동작 감지용)
 * @returns {Object} { checks: [{name, passed, message, priority}], overallScore, summaryMessage, allPassed }
 */
export function evaluatePose(motionId, landmarks, history) {
  if (!landmarks || landmarks.length < 33) {
    return {
      checks: [],
      overallScore: 0,
      summaryMessage: "포즈를 감지할 수 없습니다",
      allPassed: false,
    };
  }

  switch (motionId) {
    case 1:
      return evaluateHELP(landmarks);
    case 2:
      return evaluateJellyfishFloat(landmarks);
    case 3:
      return evaluateSignalForHelp(landmarks, history);
    case 4:
      return evaluateSculling(landmarks, history);
    case 5:
      return evaluateDogPaddle(landmarks, history);
    case 6:
      return evaluateBackFloat(landmarks);
    default:
      return {
        checks: [],
        overallScore: 0,
        summaryMessage: "알 수 없는 동작입니다",
        allPassed: false,
      };
  }
}

/**
 * 동작 1: HELP 자세 (체온 보존)
 * 팔짱 끼고 무릎을 가슴으로 끌어올려 체온 보존
 */
function evaluateHELP(landmarks) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  // 주요 포인트
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftElbow = getPoint(landmarks, 13);
  const rightElbow = getPoint(landmarks, 14);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);
  const leftKnee = getPoint(landmarks, 25);
  const rightKnee = getPoint(landmarks, 26);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);

  // 1. 팔 교차 체크
  const wristDist = distance2D(leftWrist, rightWrist);
  const wristCrossed = wristDist < shoulderWidth * 0.5;
  const wristAtChest =
    leftWrist.y > shoulderMid.y - shoulderWidth * 0.3 &&
    leftWrist.y < hipMid.y + shoulderWidth * 0.3 &&
    rightWrist.y > shoulderMid.y - shoulderWidth * 0.3 &&
    rightWrist.y < hipMid.y + shoulderWidth * 0.3;
  const armsCrossed = wristCrossed && wristAtChest;

  checks.push({
    name: "팔 교차",
    passed: armsCrossed,
    message: armsCrossed
      ? "팔이 가슴 앞에서 잘 교차되었습니다"
      : "양 팔을 가슴 앞에서 교차하세요",
    priority: 1,
  });

  // 2. 팔꿈치 각도 체크 (팔을 접은 상태)
  const leftElbowAngle = angle3D(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angle3D(rightShoulder, rightElbow, rightWrist);
  const elbowsBent = leftElbowAngle < 100 && rightElbowAngle < 100;

  checks.push({
    name: "팔꿈치 접기",
    passed: elbowsBent,
    message: elbowsBent
      ? "팔이 잘 접혀있습니다"
      : "팔을 더 접어 가슴에 밀착하세요",
    priority: 2,
  });

  // 3. 무릎 올리기 체크 (y는 위로 갈수록 작아짐)
  const kneeMid = midpoint(leftKnee, rightKnee);
  const kneeRaised = kneeMid.y < hipMid.y + shoulderWidth * 0.2;

  checks.push({
    name: "무릎 올리기",
    passed: kneeRaised,
    message: kneeRaised
      ? "무릎이 잘 올라와 있습니다"
      : "무릎을 가슴 쪽으로 끌어올리세요",
    priority: 3,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "완벽한 HELP 자세입니다! 유지하세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 동작 2: 새우등뜨기 (Jellyfish Float)
 * 상체 숙이고 무릎 감싸기
 */
function evaluateJellyfishFloat(landmarks) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  const nose = getPoint(landmarks, 0);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);
  const leftKnee = getPoint(landmarks, 25);
  const rightKnee = getPoint(landmarks, 26);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const kneeMid = midpoint(leftKnee, rightKnee);

  // 1. 상체 기울기 체크
  const torsoLean = Math.atan2(
    Math.abs(shoulderMid.x - hipMid.x),
    Math.abs(shoulderMid.y - hipMid.y)
  ) * (180 / Math.PI);
  const leanedForward = torsoLean > 25;

  checks.push({
    name: "상체 숙이기",
    passed: leanedForward,
    message: leanedForward
      ? "상체가 잘 숙여졌습니다"
      : "상체를 앞으로 더 숙이세요",
    priority: 1,
  });

  // 2. 머리 숙이기 체크 (코가 어깨보다 아래)
  const headDown = nose.y > shoulderMid.y;

  checks.push({
    name: "머리 숙이기",
    passed: headDown,
    message: headDown
      ? "머리가 잘 숙여졌습니다"
      : "머리를 아래로 숙이세요",
    priority: 2,
  });

  // 3. 손-무릎 근접 체크
  const leftWristToKnee = distance2D(leftWrist, kneeMid);
  const rightWristToKnee = distance2D(rightWrist, kneeMid);
  const handsNearKnees =
    leftWristToKnee < shoulderWidth * 0.8 &&
    rightWristToKnee < shoulderWidth * 0.8;

  checks.push({
    name: "무릎 감싸기",
    passed: handsNearKnees,
    message: handsNearKnees
      ? "양손이 무릎 근처에 있습니다"
      : "양손으로 무릎을 감싸세요",
    priority: 3,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "새우등뜨기 자세 완성! 유지하세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 동작 3: 구조 신호 (Signal for Help)
 * 한 팔만 머리 위로 올려서 좌우로 흔들기
 */
function evaluateSignalForHelp(landmarks, history) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  const nose = getPoint(landmarks, 0);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);

  // 어느 팔이 올라갔는지 판단
  const leftArmUp = leftWrist.y < nose.y;
  const rightArmUp = rightWrist.y < nose.y;
  const oneArmUp = leftArmUp !== rightArmUp; // XOR - 하나만 올라감

  // 1. 한 팔 올리기 체크
  const anyArmUp = leftArmUp || rightArmUp;
  checks.push({
    name: "팔 올리기",
    passed: anyArmUp,
    message: anyArmUp
      ? "팔이 머리 위로 올라갔습니다"
      : "한쪽 팔을 머리 위로 높이 올리세요",
    priority: 1,
  });

  // 2. 다른 팔 내리기 체크
  const otherArmDown = leftArmUp
    ? rightWrist.y > shoulderMid.y
    : leftArmUp
    ? true
    : rightArmUp
    ? leftWrist.y > shoulderMid.y
    : true;

  checks.push({
    name: "반대 팔 내리기",
    passed: oneArmUp || !anyArmUp,
    message: oneArmUp
      ? "한 팔만 올라가 있습니다"
      : anyArmUp
      ? "반대쪽 팔은 내리세요 (한 팔만 올립니다)"
      : "한쪽 팔만 올리세요",
    priority: 2,
  });

  // 3. 좌우 흔들기 체크 (히스토리 사용)
  let waving = false;
  if (history && anyArmUp) {
    const raisedWristIdx = leftArmUp ? 15 : 16;
    const movement = history.getXMovement(raisedWristIdx);
    waving = movement > 0.15; // 충분한 좌우 움직임
  }

  checks.push({
    name: "좌우 흔들기",
    passed: waving,
    message: waving
      ? "팔을 좌우로 잘 흔들고 있습니다"
      : "올린 팔을 좌우로 크게 흔드세요",
    priority: 3,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "좋습니다! 크게 흔들어 구조 신호를 보내세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 동작 4: 스컬링 (Sculling/입영)
 * 양팔을 허리~가슴 높이에서 좌우로 벌렸다 모으기
 */
function evaluateSculling(landmarks, history) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);

  // 1. 팔 높이 체크 (어깨~엉덩이 사이)
  const leftArmHeight =
    leftWrist.y > shoulderMid.y - shoulderWidth * 0.2 &&
    leftWrist.y < hipMid.y + shoulderWidth * 0.3;
  const rightArmHeight =
    rightWrist.y > shoulderMid.y - shoulderWidth * 0.2 &&
    rightWrist.y < hipMid.y + shoulderWidth * 0.3;
  const armsAtCorrectHeight = leftArmHeight && rightArmHeight;

  checks.push({
    name: "팔 높이",
    passed: armsAtCorrectHeight,
    message: armsAtCorrectHeight
      ? "팔이 적절한 높이에 있습니다"
      : "팔을 허리~가슴 높이로 유지하세요",
    priority: 1,
  });

  // 2. 대칭성 체크 (양 손목 y좌표 차이)
  const wristYDiff = Math.abs(leftWrist.y - rightWrist.y);
  const armsSymmetric = wristYDiff < shoulderWidth * 0.25;

  checks.push({
    name: "팔 대칭",
    passed: armsSymmetric,
    message: armsSymmetric
      ? "양 팔 높이가 맞습니다"
      : "양 팔 높이를 맞추세요",
    priority: 2,
  });

  // 3. 좌우 움직임 체크 (히스토리 사용)
  let scullingMotion = false;
  if (history) {
    const { range } = history.getWristDistanceChange();
    scullingMotion = range > 0.1; // 충분한 벌리기/모으기 변화
  }

  checks.push({
    name: "좌우 움직임",
    passed: scullingMotion,
    message: scullingMotion
      ? "좋은 스컬링 동작입니다"
      : "팔을 좌우로 벌렸다 모았다 반복하세요",
    priority: 3,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "좋은 스컬링 동작입니다! 리듬을 유지하세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 동작 5: 개헤엄 (Dog Paddle)
 * 양팔을 교대로 앞으로 뻗고 아래로 당기기
 */
function evaluateDogPaddle(landmarks, history) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);

  // 1. 팔 교대 체크 (양 손목 y좌표 차이)
  const wristYDiff = Math.abs(leftWrist.y - rightWrist.y);
  const armsAlternating = wristYDiff > shoulderWidth * 0.2;

  checks.push({
    name: "팔 교대",
    passed: armsAlternating,
    message: armsAlternating
      ? "팔이 교대로 움직이고 있습니다"
      : "양 팔을 교대로 위아래 움직이세요",
    priority: 1,
  });

  // 2. 뻗기 동작 체크 (위쪽 손목이 어깨보다 위)
  const upperWrist = leftWrist.y < rightWrist.y ? leftWrist : rightWrist;
  const reachingUp = upperWrist.y < shoulderMid.y;

  checks.push({
    name: "팔 뻗기",
    passed: reachingUp,
    message: reachingUp
      ? "팔을 잘 뻗고 있습니다"
      : "팔을 더 높이 뻗으세요",
    priority: 2,
  });

  // 3. 당기기 동작 체크 (아래쪽 손목이 엉덩이 근처)
  const lowerWrist = leftWrist.y > rightWrist.y ? leftWrist : rightWrist;
  const pullingDown = lowerWrist.y > hipMid.y - shoulderWidth * 0.3;

  checks.push({
    name: "팔 당기기",
    passed: pullingDown,
    message: pullingDown
      ? "팔을 잘 당기고 있습니다"
      : "물을 밀어내듯 아래로 당기세요",
    priority: 3,
  });

  // 4. 교대 움직임 체크 (히스토리 사용)
  let alternatingMotion = false;
  if (history) {
    const alternations = history.getWristAlternation();
    alternatingMotion = alternations >= 1;
  }

  checks.push({
    name: "교대 반복",
    passed: alternatingMotion,
    message: alternatingMotion
      ? "교대로 잘 반복하고 있습니다"
      : "팔을 교대로 계속 반복하세요",
    priority: 4,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "개헤엄 동작이 좋습니다! 교대로 반복하세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 동작 6: 누워뜨기 (Back Float)
 * 양팔을 어깨 높이로 옆으로 벌리기 (T자/대자)
 */
function evaluateBackFloat(landmarks) {
  const checks = [];
  const shoulderWidth = getShoulderWidth(landmarks);

  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftElbow = getPoint(landmarks, 13);
  const rightElbow = getPoint(landmarks, 14);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);

  // 1. 팔 벌리기 체크 (양 손목 간 거리)
  const wristDist = distance2D(leftWrist, rightWrist);
  const armsSpread = wristDist > shoulderWidth * 2.2;

  checks.push({
    name: "팔 벌리기",
    passed: armsSpread,
    message: armsSpread
      ? "팔이 충분히 벌어졌습니다"
      : "양 팔을 옆으로 더 벌리세요",
    priority: 1,
  });

  // 2. 팔 높이 체크 (어깨 높이)
  const leftArmAtShoulderHeight =
    Math.abs(leftWrist.y - leftShoulder.y) < shoulderWidth * 0.35;
  const rightArmAtShoulderHeight =
    Math.abs(rightWrist.y - rightShoulder.y) < shoulderWidth * 0.35;
  const armsAtShoulderHeight = leftArmAtShoulderHeight && rightArmAtShoulderHeight;

  checks.push({
    name: "팔 높이",
    passed: armsAtShoulderHeight,
    message: armsAtShoulderHeight
      ? "팔이 어깨 높이에 있습니다"
      : "팔을 어깨 높이로 맞추세요",
    priority: 2,
  });

  // 3. 팔꿈치 펴기 체크
  const leftElbowAngle = angle3D(leftShoulder, leftElbow, leftWrist);
  const rightElbowAngle = angle3D(rightShoulder, rightElbow, rightWrist);
  const elbowsStraight = leftElbowAngle > 140 && rightElbowAngle > 140;

  checks.push({
    name: "팔꿈치 펴기",
    passed: elbowsStraight,
    message: elbowsStraight
      ? "팔꿈치가 잘 펴졌습니다"
      : "팔꿈치를 펴세요",
    priority: 3,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const overallScore = Math.round((passedCount / checks.length) * 100);
  const allPassed = passedCount === checks.length;

  return {
    checks,
    overallScore,
    summaryMessage: allPassed
      ? "대자 자세 완성! 유지하세요"
      : `${passedCount}/${checks.length} 완료`,
    allPassed,
  };
}

/**
 * 준비자세 평가 (공통)
 * 서 있거나 앉아서 정면을 바라보는 기본 자세
 */
export function evaluateReadyPose(landmarks) {
  if (!landmarks || landmarks.length < 33) {
    return { isReady: false, message: "포즈를 감지할 수 없습니다" };
  }

  const shoulderWidth = getShoulderWidth(landmarks);
  const leftShoulder = getPoint(landmarks, 11);
  const rightShoulder = getPoint(landmarks, 12);
  const leftWrist = getPoint(landmarks, 15);
  const rightWrist = getPoint(landmarks, 16);
  const leftHip = getPoint(landmarks, 23);
  const rightHip = getPoint(landmarks, 24);

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);

  // 1. 어깨가 수평에 가까운지 (기울기 체크)
  const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
  const shouldersLevel = shoulderTilt < shoulderWidth * 0.15;

  // 2. 양팔이 몸 옆에 있는지
  const leftArmDown = leftWrist.y > shoulderMid.y;
  const rightArmDown = rightWrist.y > shoulderMid.y;
  const armsRelaxed = leftArmDown && rightArmDown;

  // 3. 정면을 보고 있는지 (어깨 너비가 충분히 보이는지)
  const facingCamera = shoulderWidth > 0.08; // 정규화된 값 기준

  const isReady = shouldersLevel && armsRelaxed && facingCamera;

  let message = "준비자세를 취하세요";
  if (!facingCamera) {
    message = "카메라를 정면으로 바라봐 주세요";
  } else if (!shouldersLevel) {
    message = "어깨를 수평으로 유지하세요";
  } else if (!armsRelaxed) {
    message = "양팔을 편하게 내려주세요";
  } else {
    message = "준비 완료! 동작을 시작하세요";
  }

  return { isReady, message };
}
