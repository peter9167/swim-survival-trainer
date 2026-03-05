import { MOTIONS } from "./motions";

/**
 * 연습 세션: 동작 시퀀스 추적 + 카운팅 + 유지시간
 * - holdMode: 준비자세 감지 후 → 목표자세 전환 시 타이머 시작
 * - 시퀀스: 준비자세는 무시, 동작 순서 매칭
 */
export class PracticeSession {
  constructor(motionId, overrideHoldGoal = null, overrideCycleGoal = null) {
    this.mid = motionId;
    this.motion = { ...MOTIONS[motionId] };
    if (overrideCycleGoal != null) this.motion.targetCycles = overrideCycleGoal;
    this.customHoldGoal = overrideHoldGoal ?? this.motion.holdGoal ?? this.motion.instantGoal ?? 30;
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
    this._lastCycleTime = 0;

    // 준비자세 감지 플래그
    this.readyDetected = false;
    this.readyFlashed = false;

    // 가이드 단계 (holdStages)
    this.guideStageIdx = 0;
    this.guideStageConfirmStart = null;
    this.guideStageConfirmSec = 0;
    this.guideStageFailStart = null;
    this.guideStageDone = false;

    // 순차 확인 (guidedCycles)
    this.guidedPhaseIdx = 0;
    this.guidedPhaseConfirmStart = null;
    this.guidedPhaseConfirmSec = 0;
  }

  _checkMilestones() {
    const goal = this.customHoldGoal;
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
    if (confidence < 0.35) return;

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

      this._checkMilestones();

      if (this.holdSec >= this.customHoldGoal && !this.done) {
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
          // 쿨다운: 너무 빠른 연속 카운트 방지 (최소 1초 간격)
          const now = performance.now();
          if (now - this._lastCycleTime < 1000) {
            this.seqIdx = 0;
            return;
          }
          this._lastCycleTime = now;
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

  // ── 가이드 단계 메서드 ──

  get currentGuideStage() {
    if (!this.motion.holdStages || this.guideStageDone) return null;
    return this.motion.holdStages[this.guideStageIdx] || null;
  }

  get guideStageCount() {
    return this.motion.holdStages ? this.motion.holdStages.length : 0;
  }

  updateGuideStageConfirm(passed, nowSec) {
    if (passed) {
      if (!this.guideStageConfirmStart) this.guideStageConfirmStart = nowSec;
      this.guideStageConfirmSec = nowSec - this.guideStageConfirmStart;
      this.guideStageFailStart = null; // 성공 시 실패 타이머 리셋
    } else {
      // 순간적인 감지 실패를 무시하기 위한 유예 시간 (500ms)
      if (!this.guideStageFailStart) this.guideStageFailStart = nowSec;
      if (nowSec - this.guideStageFailStart > 0.5) {
        this.guideStageConfirmStart = null;
        this.guideStageConfirmSec = 0;
      }
    }
  }

  advanceGuideStage() {
    if (!this.motion.holdStages) return;
    const stages = this.motion.holdStages;

    if (this.guideStageIdx < stages.length) {
      const completedName = stages[this.guideStageIdx].checkName;
      this.guideStageIdx++;
      this.guideStageConfirmStart = null;
      this.guideStageConfirmSec = 0;
      this.guideStageFailStart = null;

      if (this.guideStageIdx >= stages.length) {
        this.guideStageDone = true;
        this.flashMsg = "자세 완성! 유지하세요!";
        this.flashTime = performance.now();
      } else {
        this.flashMsg = `${completedName} 완료!`;
        this.flashTime = performance.now();
      }
    }
  }

  // 순차 확인 방식 사이클 카운트 (guidedCycles: 벌리기→모으기 = 1회)
  updateGuidedCycle(phase, nowSec) {
    if (this.done) return;
    const seq = this.motion.sequence;
    const expected = seq[this.guidedPhaseIdx];

    if (phase === expected) {
      // 맞는 phase — 확인 타이머 누적
      if (!this.guidedPhaseConfirmStart) this.guidedPhaseConfirmStart = nowSec;
      this.guidedPhaseConfirmSec = nowSec - this.guidedPhaseConfirmStart;

      const confirmTime = this.motion.guidedConfirmSec || 0.5;
      if (this.guidedPhaseConfirmSec >= confirmTime) {
        // 확인 완료 → 다음 phase로
        this.guidedPhaseIdx++;
        this.guidedPhaseConfirmStart = null;
        this.guidedPhaseConfirmSec = 0;

        if (this.guidedPhaseIdx >= seq.length) {
          // 사이클 완료
          this.cyclesDone++;
          this.guidedPhaseIdx = 0;
          this.score = Math.min(20, Math.floor((this.cyclesDone / this.motion.targetCycles) * 20));

          if (this.cyclesDone >= this.motion.targetCycles) {
            this.done = true;
            this.score = 20;
            this.flashMsg = `${this.motion.targetCycles}회 달성! 🎉`;
            this.flashTime = performance.now();
          } else {
            this.flashMsg = `✓ ${this.cyclesDone}회!`;
            this.flashTime = performance.now();
          }
        } else {
          this.flashMsg = `✓ ${expected}`;
          this.flashTime = performance.now();
        }
      }
    } else {
      // 다른 phase — 타이머 리셋
      this.guidedPhaseConfirmStart = null;
      this.guidedPhaseConfirmSec = 0;
    }
  }

  // 현재 기대되는 phase 이름
  get currentGuidedPhase() {
    if (!this.motion.guidedCycles) return null;
    return this.motion.sequence[this.guidedPhaseIdx] || null;
  }

  // 즉시 모드 누적 시간 추적 (시퀀스 동작용)
  // 자세가 맞을 때만 시간 누적, 틀리면 일시정지 (리셋 안 함)
  updateInstantHold(nowSec) {
    if (this.done) return;
    if (!this.holdStart) {
      this.holdStart = nowSec;
      return; // 첫 프레임은 기준점만 설정
    }
    const delta = nowSec - this.holdStart;
    this.holdStart = nowSec;
    this.holdSec += delta;

    this._checkMilestones();

    if (this.holdSec >= this.customHoldGoal) {
      this.done = true;
      this.score = 20;
    } else {
      this.score = Math.min(20, Math.floor((this.holdSec / goal) * 20));
    }
  }
}
