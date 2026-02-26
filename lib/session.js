import { MOTIONS } from "./motions";

/**
 * 연습 세션: 동작 시퀀스 추적 + 카운팅 + 유지시간
 * - holdMode: 준비자세 감지 후 → 목표자세 전환 시 타이머 시작
 * - 시퀀스: 준비자세는 무시, 동작 순서 매칭
 */
export class PracticeSession {
  constructor(motionId, overrideHoldGoal = null) {
    this.mid = motionId;
    this.motion = MOTIONS[motionId];
    this.customHoldGoal = overrideHoldGoal ?? this.motion.holdGoal ?? 30;
    this.reset();
  }

  reset() {
    this.seqIdx = 0;
    this.cyclesDone = 0;
    this.score = 0;
    this.done = false;
    this.lastStep = "";
    this.currentLabel = "";
    this.confidence = 0;
    this.holdStart = null;
    this.holdSec = 0;
    this.stableHistory = [];
    this.flashMsg = "";
    this.flashTime = 0;
    this._milestones = {};

    // 준비자세 감지 플래그
    this.readyDetected = false;
    this.readyFlashed = false;
  }

  get effectiveHoldGoal() {
    return this.motion.holdMode ? this.customHoldGoal : null;
  }

  update(label, confidence, nowSec) {
    this.currentLabel = label;
    this.confidence = confidence;
    if (!label || this.done) return;

    // 안정화: 최근 8프레임 과반수
    this.stableHistory.push(label);
    if (this.stableHistory.length > 8) this.stableHistory.shift();

    const counts = {};
    this.stableHistory.forEach((l) => (counts[l] = (counts[l] || 0) + 1));
    let stableLabel = label,
      maxCount = 0;
    for (const [l, c] of Object.entries(counts)) {
      if (c > maxCount) {
        maxCount = c;
        stableLabel = l;
      }
    }

    if (maxCount < this.stableHistory.length * 0.5) return;
    if (confidence < 0.45) return;

    // ── 준비자세 감지 ──
    if (stableLabel === "준비자세") {
      if (!this.readyDetected) {
        this.readyDetected = true;
      }
      // 유지자세 중 준비자세로 돌아가면 타이머 정지 (자세 이탈)
      if (this.motion.holdMode) {
        this.holdStart = null;
      }
      return;
    }

    // ── 준비자세 미감지 시 무시 ──
    if (!this.readyDetected) return;

    // 준비 감지 후 첫 플래시
    if (!this.readyFlashed) {
      this.readyFlashed = true;
      this.flashMsg = "준비완료! 동작을 시작하세요 💪";
      this.flashTime = performance.now();
    }

    // ── 유지 자세: 시간 기반 (HELP, 새우등, 누워뜨기 등) ──
    if (this.motion.holdMode && stableLabel === this.motion.sequence[0]) {
      if (!this.holdStart) this.holdStart = nowSec;
      this.holdSec = nowSec - this.holdStart;

      const goal = this.customHoldGoal;
      // 동적 마일스톤: goal/3 간격
      const step = Math.max(5, Math.round(goal / 3));
      const milestones = [];
      for (let s = step; s <= goal; s += step) milestones.push(s);
      if (!milestones.includes(goal)) milestones.push(goal);

      for (const sec of milestones) {
        if (this.holdSec >= sec && !this._milestones[sec]) {
          this._milestones[sec] = true;
          this.flashMsg = sec >= goal ? `${sec}초 달성! 🎉` : `${sec}초!`;
          this.flashTime = performance.now();
        }
      }

      if (this.holdSec >= goal && !this.done) {
        this.cyclesDone = 1;
        this.score = 20;
        this.done = true;
      } else {
        this.score = Math.min(20, Math.floor((this.holdSec / goal) * 20));
      }
      return;
    } else if (this.motion.holdMode) {
      // holdMode인데 다른 라벨이면 타이머 정지
      this.holdStart = null;
      this.holdSec = 0;
    }

    // ── 시퀀스 매칭 (개헤엄, 스컬링, 구조신호 등) ──
    const seq = this.motion.sequence;
    if (this.seqIdx < seq.length) {
      const expected = seq[this.seqIdx];
      if (stableLabel === expected && stableLabel !== this.lastStep) {
        this.lastStep = stableLabel;
        this.seqIdx++;

        if (this.seqIdx >= seq.length) {
          this.cyclesDone++;
          this.seqIdx = 0;
          this.lastStep = "";

          if (this.cyclesDone >= this.motion.targetCycles) {
            this.done = true;
            this.score = 20;
            this.flashMsg = `${this.motion.targetCycles}회 달성! 🎉`;
            this.flashTime = performance.now();
          } else {
            this.score = Math.floor(
              (this.cyclesDone / this.motion.targetCycles) * 20
            );
            this.flashMsg = `${this.cyclesDone}회 완료!`;
            this.flashTime = performance.now();
          }
        }
      }
    }
  }

  get expected() {
    if (!this.readyDetected) return "준비자세";
    const seq = this.motion.sequence;
    return this.seqIdx < seq.length ? seq[this.seqIdx] : "";
  }
}
