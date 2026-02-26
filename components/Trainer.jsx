"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { MOTIONS } from "@/lib/motions";
import { extractFeatures } from "@/lib/features";
import { KNNClassifier } from "@/lib/knn";
import { PracticeSession } from "@/lib/session";

// 스켈레톤 연결
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export default function Trainer() {
  // 상태
  const [mode, setMode] = useState("menu"); // menu | record | practice
  const [currentMotion, setCurrentMotion] = useState(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [fps, setFps] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [holdGoalInput, setHoldGoalInput] = useState(30);
  const [, forceUpdate] = useState(0);

  // refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraAreaRef = useRef(null);
  const landmarkerRef = useRef(null);
  const classifiersRef = useRef({});
  const sessionRef = useRef(null);
  const lastPoseRef = useRef(null);
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(performance.now());
  const lastTimestampRef = useRef(0);
  const rafRef = useRef(null);
  const flashRef = useRef([]);
  const streamRef = useRef(null);

  // ── 초기화 (MediaPipe + KNN만, 카메라는 별도) ──
  useEffect(() => {
    async function init() {
      // KNN 분류기 초기화 + localStorage 로드
      for (let i = 1; i <= 6; i++) {
        classifiersRef.current[i] = new KNNClassifier(5);
        const saved = localStorage.getItem(`swim_knn_${i}`);
        if (saved) {
          classifiersRef.current[i].import(saved);
        }
      }

      // MediaPipe 로드 (동적 import — SSR 회피)
      const vision = await import("@mediapipe/tasks-vision");
      const { PoseLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      landmarkerRef.current = await PoseLandmarker.createFromOptions(
        filesetResolver,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
      );
      forceUpdate((n) => n + 1); // re-render to show "ready"
    }

    init().catch((err) => console.error("Init failed:", err));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, []);

  // ── 카메라 시작/중지 ──
  async function startCamera() {
    if (streamRef.current) return; // 이미 활성
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      lastTimestampRef.current = 0;
      rafRef.current = requestAnimationFrame(mainLoop);
    } catch (err) {
      console.error("Camera failed:", err);
    }
  }

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFps(0);
  }

  // ── 모드 전환 시 카메라 제어 ──
  useEffect(() => {
    if (mode === "menu") {
      stopCamera();
    } else {
      startCamera();
    }
  }, [mode]);

  // ── 메인 루프 ──
  const mainLoop = useCallback(
    (timestamp) => {
      rafRef.current = requestAnimationFrame(mainLoop);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!landmarker || !video || !canvas || !video.videoWidth) return;

      // FPS
      frameCountRef.current++;
      if (timestamp - fpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        fpsTimeRef.current = timestamp;
      }

      // 캔버스 리사이즈
      const area = cameraAreaRef.current;
      if (area && (canvas.width !== area.clientWidth || canvas.height !== area.clientHeight)) {
        canvas.width = area.clientWidth;
        canvas.height = area.clientHeight;
      }

      if (timestamp <= lastTimestampRef.current) return;
      lastTimestampRef.current = timestamp;

      const result = landmarker.detectForVideo(video, timestamp);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.landmarks && result.landmarks.length > 0) {
        const lms = result.landmarks[0];
        lastPoseRef.current = lms;
        drawSkeleton(ctx, lms, canvas.width, canvas.height, video.videoWidth, video.videoHeight);

        // 연습 모드 분석
        const session = sessionRef.current;
        const clf = classifiersRef.current[sessionRef.current?.mid];
        if (session && clf && clf.numClasses >= 2) {
          const features = extractFeatures(lms);
          const { label, confidence } = clf.predict(features);
          session.update(label, confidence, timestamp / 1000);

          // 플래시 메시지 체크
          if (session.flashMsg && performance.now() - session.flashTime < 100) {
            addFlash(session.flashMsg);
            session.flashMsg = "";
          }
          forceUpdate((n) => n + 1);
        }
      } else {
        lastPoseRef.current = null;
      }
    },
    []
  );

  // ── 스켈레톤 ──
  function drawSkeleton(ctx, lms, cw, ch, vw, vh) {
    const scale = Math.max(cw / vw, ch / vh);
    const ox = (cw - vw * scale) / 2;
    const oy = (ch - vh * scale) / 2;

    function toScreen(lm) {
      return [(1 - lm.x) * vw * scale + ox, lm.y * vh * scale + oy];
    }

    ctx.strokeStyle = "rgba(34, 211, 238, 0.6)";
    ctx.lineWidth = 2.5;
    for (const [a, b] of CONNECTIONS) {
      const [x1, y1] = toScreen(lms[a]);
      const [x2, y2] = toScreen(lms[b]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    for (let i = 11; i < 33; i++) {
      const [x, y] = toScreen(lms[i]);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ── 플래시 메시지 ──
  function addFlash(msg) {
    const id = Date.now();
    flashRef.current = [...flashRef.current, { id, msg }];
    forceUpdate((n) => n + 1);
    setTimeout(() => {
      flashRef.current = flashRef.current.filter((f) => f.id !== id);
      forceUpdate((n) => n + 1);
    }, 2500);
  }

  // ── 녹화 ──
  function recordSample() {
    if (!lastPoseRef.current || !currentMotion) return;
    const m = MOTIONS[currentMotion];
    const stepName = m.steps[selectedStep];
    const features = extractFeatures(lastPoseRef.current);
    const clf = classifiersRef.current[currentMotion];
    clf.addSample(stepName, features);
    localStorage.setItem(`swim_knn_${currentMotion}`, clf.export());

    const cnt = clf.getSampleCounts()[stepName] || 0;
    addFlash(`${stepName} 녹화! (${cnt}개)`);
    forceUpdate((n) => n + 1);
  }

  // ── 키보드 ──
  useEffect(() => {
    function onKey(e) {
      if (mode === "menu") {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 6) {
          setCurrentMotion(n);
          setSelectedStep(0);
          setHoldGoalInput(MOTIONS[n]?.holdGoal || 30);
          setMode("record");
        }
      } else if (mode === "record") {
        if (e.code === "Space") {
          e.preventDefault();
          recordSample();
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          e.preventDefault();
          setSelectedStep((s) => Math.max(0, s - 1));
        } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          e.preventDefault();
          const max = currentMotion ? MOTIONS[currentMotion].steps.length - 1 : 0;
          setSelectedStep((s) => Math.min(max, s + 1));
        } else if (e.key === "Escape") {
          setMode("menu");
        }
      } else if (mode === "practice") {
        if (e.key === "r" || e.key === "R") {
          sessionRef.current?.reset();
          forceUpdate((n) => n + 1);
        } else if (e.key === "Escape") {
          setMode("menu");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, currentMotion, selectedStep]);

  // ── 메뉴 화면 ──
  function renderMenu() {
    return (
      <div className="menu-screen">
        <div className="menu-title">🏊 생존수영 트레이너</div>
        <div className="menu-subtitle">ML 기반 실시간 동작 분석 시스템</div>

        {Object.entries(MOTIONS).map(([id, m]) => {
          const clf = classifiersRef.current[id];
          const total = clf?.totalSamples || 0;
          const trained = (clf?.numClasses || 0) >= 2;
          let statusClass, statusText;
          if (trained && total >= 20) {
            statusClass = "status-trained";
            statusText = `학습됨 (${total})`;
          } else if (total > 0) {
            statusClass = "status-data";
            statusText = `${total}개 수집`;
          } else {
            statusClass = "status-empty";
            statusText = "미학습";
          }

          return (
            <div
              key={id}
              className="motion-card"
              onClick={() => {
                setCurrentMotion(parseInt(id));
                setSelectedStep(0);
                setHoldGoalInput(m.holdGoal || 30);
                setMode("record");
              }}
            >
              <div className="motion-num">{m.icon}</div>
              <div className="motion-info">
                <h3>
                  {m.name}{" "}
                  <span style={{ color: "var(--text3)", fontWeight: 400, fontSize: 13 }}>
                    {m.sub}
                  </span>
                  {" "}
                  <span style={{
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: m.posture === "standing" ? "#3b82f620" : "#10b98120",
                    color: m.posture === "standing" ? "#60a5fa" : "#34d399",
                    fontWeight: 500,
                  }}>
                    {m.posture === "standing" ? "서서" : "앉아서"}
                  </span>
                </h3>
                <p>{m.desc}</p>
              </div>
              <span className={`motion-status ${statusClass}`}>{statusText}</span>
            </div>
          );
        })}

        <div className="menu-footer">
          동작 선택 → SPACE로 자세 녹화 → 연습
          <br />
          키보드: 1~6 선택 · SPACE 녹화 · ESC 메뉴
          <br />
          <a href="/admin" style={{ color: "var(--text3)", fontSize: 12, textDecoration: "underline" }}>
            ⚙ 학습 데이터 관리
          </a>
        </div>
      </div>
    );
  }

  // ── 녹화 패널 ──
  function renderRecordPanel() {
    if (!currentMotion) return null;
    const m = MOTIONS[currentMotion];
    const clf = classifiersRef.current[currentMotion];
    const counts = clf?.getSampleCounts() || {};
    const trained = (clf?.numClasses || 0) >= 2;
    const readySteps = m.steps.filter((s) => (counts[s] || 0) >= 5).length;
    const canTrain = readySteps >= 2;
    const total = clf?.totalSamples || 0;

    return (
      <div className="side-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={() => setMode("menu")}>
            ← 메뉴
          </button>
          <h2>
            {m.icon} {m.name}
          </h2>
          <span className="mode-badge mode-record">녹화</span>
        </div>
        <div className="panel-content">
          {m.guide && (
            <div style={{
              padding: "8px 12px",
              marginBottom: 10,
              background: "var(--surface2)",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text2)",
              borderLeft: `3px solid ${m.posture === "standing" ? "#60a5fa" : "#34d399"}`,
            }}>
              {m.posture === "standing" ? "🧍 " : "🪑 "}
              {m.guide}
            </div>
          )}
          <div className="section-label">단계 선택 (클릭 또는 ↑↓)</div>

          {m.steps.map((step, i) => {
            const cnt = counts[step] || 0;
            const isActive = i === selectedStep;
            let iconClass = "empty";
            if (isActive) iconClass = "recording";
            else if (cnt >= 10) iconClass = "ready";
            else if (cnt > 0) iconClass = "has-data";

            return (
              <div key={step}>
                <div
                  className={`step-item ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedStep(i)}
                >
                  <div className={`step-icon ${iconClass}`}>
                    {isActive ? "▶" : cnt >= 10 ? "✓" : cnt || "·"}
                  </div>
                  <span className="step-name">{step}</span>
                  <span className="step-count">{cnt}개</span>
                </div>
                <div className="mini-bar">
                  <div
                    className="mini-bar-fill"
                    style={{
                      width: `${Math.min((cnt / 15) * 100, 100)}%`,
                      background:
                        cnt >= 10
                          ? "var(--success)"
                          : cnt > 0
                          ? "var(--warning)"
                          : "var(--border)",
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div className="section-label" style={{ marginTop: 24 }}>
            녹화 ({total}개 수집됨)
          </div>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 10 }}>
            자세를 취하고 <b style={{ color: "var(--accent)" }}>SPACE</b>를 눌러 저장.
            단계별 10~15개 권장.
          </p>

          <button
            className="btn btn-primary"
            disabled={!canTrain}
            onClick={() => {
              localStorage.setItem(
                `swim_knn_${currentMotion}`,
                clf.export()
              );
              addFlash("저장 완료! ✨");
              forceUpdate((n) => n + 1);
            }}
          >
            💾 데이터 저장 ({readySteps}/{m.steps.length} 단계)
          </button>

          {/* 유지시간 설정 (holdMode 동작만) */}
          {m.holdMode && (
            <div style={{
              margin: "12px 0",
              padding: "10px 12px",
              background: "var(--surface2)",
              borderRadius: 8,
            }}>
              <label style={{ fontSize: 13, color: "var(--text2)" }}>
                ⏱ 유지 시간 목표
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={holdGoalInput}
                  onChange={(e) => setHoldGoalInput(parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 700, fontSize: 16, color: "var(--accent)", minWidth: 45, textAlign: "right" }}>
                  {holdGoalInput}초
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-success"
            disabled={!trained}
            onClick={() => {
              const goal = m.holdMode ? holdGoalInput : null;
              sessionRef.current = new PracticeSession(currentMotion, goal);
              setMode("practice");
            }}
          >
            ▶ 연습 모드
          </button>

          <button
            className="btn btn-danger"
            style={{ marginTop: 16 }}
            onClick={() => {
              if (confirm("이 동작의 모든 녹화 데이터를 삭제할까요?")) {
                clf.clear();
                localStorage.removeItem(`swim_knn_${currentMotion}`);
                forceUpdate((n) => n + 1);
              }
            }}
          >
            🗑 데이터 초기화
          </button>
        </div>
      </div>
    );
  }

  // ── 연습 패널 ──
  function renderPracticePanel() {
    const session = sessionRef.current;
    if (!session || !currentMotion) return null;
    const m = session.motion;

    const pct = session.score / 20;
    const barColor =
      pct >= 0.8 ? "var(--success)" : pct >= 0.4 ? "var(--warning)" : "var(--danger)";
    const confColor =
      session.confidence > 0.7
        ? "var(--success)"
        : session.confidence > 0.4
        ? "var(--warning)"
        : "var(--danger)";
    const isMatch =
      session.currentLabel === session.expected && session.confidence > 0.5;

    return (
      <div className="side-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={() => setMode("menu")}>
            ← 메뉴
          </button>
          <h2>
            {m.icon} {m.name}
          </h2>
          <span className="mode-badge mode-practice">연습</span>
        </div>
        <div className="panel-content">
          {m.guide && (
            <div style={{
              padding: "8px 12px",
              marginBottom: 10,
              background: "var(--surface2)",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text2)",
              borderLeft: `3px solid ${m.posture === "standing" ? "#60a5fa" : "#34d399"}`,
            }}>
              {m.posture === "standing" ? "🧍 " : "🪑 "}
              {m.guide}
            </div>
          )}
          <div className="section-label">점수</div>
          <div className="score-bar-wrap">
            <div
              className="score-bar-fill"
              style={{ width: `${pct * 100}%`, background: barColor }}
            >
              {session.score}/20점
            </div>
          </div>

          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              margin: "12px 0",
              color: "var(--yellow)",
            }}
          >
            {session.done
              ? "🎉 완료!"
              : `${session.cyclesDone} / ${m.targetCycles}회`}
          </div>

          {/* 준비자세 감지 상태 */}
          {!session.readyDetected && !session.done && (
            <div style={{
              padding: "8px 12px",
              background: "#f59e0b15",
              border: "1px solid #f59e0b40",
              borderRadius: 8,
              fontSize: 13,
              color: "#fbbf24",
              textAlign: "center",
              marginBottom: 8,
            }}>
              🪑 먼저 <b>준비자세</b>를 취하세요
            </div>
          )}
          {session.readyDetected && !session.done && !session.holdStart && session.cyclesDone === 0 && (
            <div style={{
              padding: "8px 12px",
              background: "#10b98115",
              border: "1px solid #10b98140",
              borderRadius: 8,
              fontSize: 13,
              color: "#34d399",
              textAlign: "center",
              marginBottom: 8,
            }}>
              ✅ 준비 완료! 동작을 시작하세요
            </div>
          )}

          {/* 유지시간 표시 (HELP, 새우등, 누워뜨기) */}
          {m.holdMode && session.holdSec > 0 && (
            <div className="hold-timer">
              <div className="hold-circle">
                <svg viewBox="0 0 108 108">
                  <circle cx="54" cy="54" r="46" stroke="var(--border)" />
                  <circle
                    cx="54"
                    cy="54"
                    r="46"
                    stroke="var(--accent)"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={
                      2 * Math.PI * 46 * (1 - Math.min(session.holdSec / session.customHoldGoal, 1))
                    }
                  />
                </svg>
                <span className="hold-time-text">
                  {session.holdSec.toFixed(1)}
                </span>
              </div>
              <span className="hold-label">/ {session.customHoldGoal}초</span>
            </div>
          )}

          <div className="section-label">인식 상태</div>
          <div className="detect-box">
            <div className="detect-label" style={{ color: confColor }}>
              {session.currentLabel || "대기 중..."}
            </div>
            <div className="detect-conf">
              확신도: {(session.confidence * 100).toFixed(0)}%
            </div>
            {!session.done && session.expected && (
              <div className="detect-expected">
                다음 동작:{" "}
                <b style={{ color: "var(--accent)" }}>{session.expected}</b>
                {isMatch && (
                  <>
                    <br />
                    <span style={{ color: "var(--success)", fontWeight: 700 }}>
                      ✓ 정확한 자세!
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="section-label">시퀀스 진행</div>
          <div className="seq-steps">
            {m.sequence.map((step, i) => {
              let cls;
              if (i < session.seqIdx) cls = "seq-done";
              else if (i === session.seqIdx) cls = "seq-current";
              else cls = "seq-todo";
              return (
                <span key={i} className={`seq-step ${cls}`}>
                  {step}
                </span>
              );
            })}
          </div>

          <button
            className="btn btn-outline"
            style={{ marginTop: 24 }}
            onClick={() => {
              sessionRef.current.reset();
              forceUpdate((n) => n + 1);
            }}
          >
            ↺ 리셋
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              setSelectedStep(0);
              setMode("record");
            }}
          >
            ✏ 녹화 모드로
          </button>
        </div>
      </div>
    );
  }

  // ── 렌더 ──
  return (
    <div className="app">
      {mode !== "menu" ? (
        <div
          className={`camera-area ${
            mode === "practice" && sessionRef.current?.done ? "completed" : ""
          }`}
          ref={cameraAreaRef}
        >
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={canvasRef} />
          {cameraActive && <div className="fps-badge">FPS: {fps}</div>}

          {/* 플래시 메시지 */}
          {flashRef.current.map((f) => (
            <div key={f.id} className="flash-msg">
              {f.msg}
            </div>
          ))}
        </div>
      ) : (
        <div className="camera-area" style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          background: "var(--bg)",
        }}>
          <div style={{ fontSize: 64 }}>🏊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
            생존수영 트레이너
          </div>
          <div style={{ fontSize: 13, color: "var(--text3)" }}>
            {landmarkerRef.current ? "✅ AI 모델 준비 완료" : "⏳ AI 모델 로딩 중..."}
          </div>
          {/* hidden video for ref */}
          <video ref={videoRef} style={{ display: "none" }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {/* 메뉴 */}
      {mode === "menu" && renderMenu()}

      {/* 녹화 패널 */}
      {mode === "record" && renderRecordPanel()}

      {/* 연습 패널 */}
      {mode === "practice" && renderPracticePanel()}
    </div>
  );
}
