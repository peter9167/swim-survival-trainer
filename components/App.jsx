"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MOTIONS } from "@/lib/motions";
import { extractFeatures } from "@/lib/features";
import { KNNClassifier } from "@/lib/knn";
import { PracticeSession } from "@/lib/session";
import { evaluatePose, evaluateReadyPose, FeedbackHistory } from "@/lib/feedback";

// 스켈레톤 연결선
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

// 학습 콘텐츠 데이터
const LEARN_CONTENT = {
  intro: {
    title: "생존수영이란",
    icon: "📘",
    content: `생존수영은 위급한 수상 상황에서 자신의 생명을 지키기 위한 기본적인 수영 기술입니다.

물에 빠졌을 때 구조대가 올 때까지 체력을 보존하고, 침착하게 대응하는 방법을 배웁니다.

2015년부터 초등학교 정규 교육과정에 포함되어 모든 학생들이 배우게 되었습니다.`,
    points: [
      "물에서 호흡 유지하기",
      "체온 보존 자세 취하기",
      "구조 신호 보내기",
      "기본 영법으로 이동하기"
    ]
  },
  safety: {
    title: "물놀이 안전수칙",
    icon: "⚠️",
    content: `안전한 물놀이를 위해 반드시 지켜야 할 수칙들입니다.`,
    points: [
      "수영 전 충분한 준비운동 하기",
      "보호자나 안전요원이 있는 곳에서만 수영하기",
      "음식을 먹은 직후에는 수영하지 않기",
      "수심을 확인하고 뛰어들지 않기",
      "구명조끼 착용하기"
    ]
  },
  cpr: {
    title: "심폐소생술",
    icon: "❤️",
    content: `익수자를 구조한 후 의식이 없고 호흡이 없다면 즉시 심폐소생술을 시작해야 합니다.`,
    points: [
      "119에 신고하기",
      "가슴 압박 30회 실시",
      "인공호흡 2회 실시",
      "구급대가 올 때까지 반복"
    ]
  }
};

export default function App() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState("home");

  // 연습/녹화 상태
  const [practiceMode, setPracticeMode] = useState(null); // null | "select" | "instant" | "knn" | "record"
  const [currentMotion, setCurrentMotion] = useState(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [holdGoalInput, setHoldGoalInput] = useState(30);

  // 학습 상태
  const [learnView, setLearnView] = useState(null); // null | motionId | "intro" | "safety" | "cpr"

  // 카메라/AI 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [, forceUpdate] = useState(0);

  // 카메라 선택
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swim_camera_id") || "";
    }
    return "";
  });

  // 피드백 상태
  const [feedback, setFeedback] = useState(null);

  // 토스트
  const [toast, setToast] = useState(null);

  // refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraContainerRef = useRef(null);
  const landmarkerRef = useRef(null);
  const classifiersRef = useRef({});
  const sessionRef = useRef(null);
  const lastPoseRef = useRef(null);
  const feedbackHistoryRef = useRef(new FeedbackHistory(15));
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(performance.now());
  const lastTimestampRef = useRef(0);
  const rafRef = useRef(null);
  const flashRef = useRef([]);
  const streamRef = useRef(null);

  // ═══════════════════════════════════════════════════════════
  // 초기화
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    async function init() {
      // KNN 분류기 로드
      for (let i = 1; i <= 6; i++) {
        classifiersRef.current[i] = new KNNClassifier(5);
        const saved = localStorage.getItem(`swim_knn_${i}`);
        if (saved) {
          classifiersRef.current[i].import(saved);
        }
      }

      // MediaPipe 로드
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
      setModelReady(true);
    }

    init().catch(console.error);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 카메라 제어
  // ═══════════════════════════════════════════════════════════

  // 카메라 목록 가져오기
  async function loadCameras() {
    try {
      // 권한 요청을 위해 임시로 미디어 스트림 획득
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === "videoinput");
      setCameras(videoDevices);

      // 저장된 카메라가 없거나 유효하지 않으면 첫 번째 카메라 선택
      if (!selectedCameraId || !videoDevices.find(d => d.deviceId === selectedCameraId)) {
        if (videoDevices.length > 0) {
          setSelectedCameraId(videoDevices[0].deviceId);
        }
      }
    } catch (err) {
      console.error("Failed to load cameras:", err);
    }
  }

  // 초기 카메라 목록 로드
  useEffect(() => {
    loadCameras();
  }, []);

  async function startCamera() {
    if (streamRef.current) return;
    try {
      const constraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 720 }, height: { ideal: 1280 } }
          : { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      lastTimestampRef.current = 0;
      feedbackHistoryRef.current.clear();
      rafRef.current = requestAnimationFrame(mainLoop);
    } catch (err) {
      console.error("Camera failed:", err);
      showToast("카메라를 사용할 수 없습니다", "error");
    }
  }

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFps(0);
    setFeedback(null);
  }

  // ═══════════════════════════════════════════════════════════
  // 메인 루프
  // ═══════════════════════════════════════════════════════════
  const mainLoop = useCallback((timestamp) => {
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
    const container = cameraContainerRef.current;
    if (container && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
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

      // 피드백 히스토리 업데이트
      feedbackHistoryRef.current.add(lms);

      // 즉시 연습 모드: 규칙 기반 피드백
      if (practiceMode === "instant" && currentMotion) {
        const fb = evaluatePose(currentMotion, lms, feedbackHistoryRef.current);
        setFeedback(fb);

        // 모든 체크포인트 통과 시 세션 업데이트
        const session = sessionRef.current;
        if (session && fb.allPassed) {
          session.update(session.motion.sequence[0] || "완료", 1.0, timestamp / 1000);
          if (session.flashMsg && performance.now() - session.flashTime < 100) {
            addFlash(session.flashMsg);
            session.flashMsg = "";
          }
          forceUpdate(n => n + 1);
        }
      }

      // KNN 연습 모드
      if (practiceMode === "knn" && currentMotion) {
        const session = sessionRef.current;
        const clf = classifiersRef.current[currentMotion];
        if (session && clf && clf.numClasses >= 2) {
          const features = extractFeatures(lms);
          const { label, confidence } = clf.predict(features);
          session.update(label, confidence, timestamp / 1000);

          if (session.flashMsg && performance.now() - session.flashTime < 100) {
            addFlash(session.flashMsg);
            session.flashMsg = "";
          }

          // 규칙 기반 피드백도 병행
          const fb = evaluatePose(currentMotion, lms, feedbackHistoryRef.current);
          setFeedback(fb);

          forceUpdate(n => n + 1);
        }
      }
    } else {
      lastPoseRef.current = null;
      setFeedback(null);
    }
  }, [practiceMode, currentMotion]);

  // ═══════════════════════════════════════════════════════════
  // 스켈레톤 그리기
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // 유틸리티
  // ═══════════════════════════════════════════════════════════
  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  function addFlash(msg) {
    const id = Date.now();
    flashRef.current = [...flashRef.current, { id, msg }];
    forceUpdate(n => n + 1);
    setTimeout(() => {
      flashRef.current = flashRef.current.filter(f => f.id !== id);
      forceUpdate(n => n + 1);
    }, 2500);
  }

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
    forceUpdate(n => n + 1);
  }

  function startPractice(motionId, mode) {
    setCurrentMotion(motionId);
    const m = MOTIONS[motionId];
    const goal = m.holdMode ? holdGoalInput : null;
    sessionRef.current = new PracticeSession(motionId, goal);
    feedbackHistoryRef.current.clear();
    setPracticeMode(mode);
    startCamera();
  }

  function exitPractice() {
    stopCamera();
    setPracticeMode(null);
    setCurrentMotion(null);
    sessionRef.current = null;
    setFeedback(null);
  }

  // ═══════════════════════════════════════════════════════════
  // 히스토리 관리
  // ═══════════════════════════════════════════════════════════
  function saveHistory(session) {
    if (!session || !session.done) return;
    const history = JSON.parse(localStorage.getItem("swim_history") || "[]");
    history.unshift({
      id: Date.now(),
      motionId: session.mid,
      date: new Date().toISOString(),
      score: session.score,
      holdSec: session.holdSec,
      cycles: session.cyclesDone,
    });
    // 최근 100개만 보관
    localStorage.setItem("swim_history", JSON.stringify(history.slice(0, 100)));
  }

  // ═══════════════════════════════════════════════════════════
  // 탭 렌더링
  // ═══════════════════════════════════════════════════════════

  // 홈 탭
  function renderHomeTab() {
    return (
      <div className="main-content">
        <div className="home-hero">
          <div className="hero-icon">🏊</div>
          <h1>생존수영 트레이너</h1>
          <p>AI 기반 실시간 동작 분석 시스템</p>
        </div>

        <div className="home-section">
          <div className="section-title">🎯 6대 생존수영 동작</div>
          {Object.entries(MOTIONS).map(([id, m]) => {
            const clf = classifiersRef.current[id];
            const total = clf?.totalSamples || 0;

            return (
              <div
                key={id}
                className="motion-card"
                onClick={() => {
                  setActiveTab("practice");
                  setPracticeMode("select");
                  setCurrentMotion(parseInt(id));
                  setHoldGoalInput(m.holdGoal || 30);
                }}
              >
                <div className="card-icon">{m.icon}</div>
                <div className="card-info">
                  <h3>
                    {m.name}
                    <span className={`card-badge ${m.posture === "standing" ? "badge-standing" : "badge-seated"}`}>
                      {m.posture === "standing" ? "서서" : "앉아서"}
                    </span>
                  </h3>
                  <p>{m.desc}</p>
                </div>
                <div className="card-arrow">›</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 학습 탭
  function renderLearnTab() {
    if (learnView) {
      return renderLearnDetail();
    }

    return (
      <div className="main-content">
        <div className="page-header">
          <h1>📖 학습</h1>
          <p>생존수영의 기초부터 응급처치까지</p>
        </div>

        {/* 생존수영 소개 */}
        <div className="learn-category">
          <div className="category-header">생존수영 소개</div>
          <div className="learn-item" onClick={() => setLearnView("intro")}>
            <span className="item-icon">📘</span>
            <div className="item-text">
              <h4>생존수영이란</h4>
              <p>생존수영의 정의와 필요성</p>
            </div>
            <span className="item-arrow">›</span>
          </div>
        </div>

        {/* 생존뜨기 */}
        <div className="learn-category">
          <div className="category-header">생존뜨기</div>
          {[1, 2, 6].map(id => {
            const m = MOTIONS[id];
            return (
              <div key={id} className="learn-item" onClick={() => setLearnView(id)}>
                <span className="item-icon">{m.icon}</span>
                <div className="item-text">
                  <h4>{m.name}</h4>
                  <p>{m.sub}</p>
                </div>
                <span className="item-arrow">›</span>
              </div>
            );
          })}
        </div>

        {/* 생존수영 영법 */}
        <div className="learn-category">
          <div className="category-header">생존수영 영법</div>
          {[5, 4, 3].map(id => {
            const m = MOTIONS[id];
            return (
              <div key={id} className="learn-item" onClick={() => setLearnView(id)}>
                <span className="item-icon">{m.icon}</span>
                <div className="item-text">
                  <h4>{m.name}</h4>
                  <p>{m.sub}</p>
                </div>
                <span className="item-arrow">›</span>
              </div>
            );
          })}
        </div>

        {/* 안전/응급 */}
        <div className="learn-category">
          <div className="category-header">수상안전 / 응급처치</div>
          <div className="learn-item" onClick={() => setLearnView("safety")}>
            <span className="item-icon">⚠️</span>
            <div className="item-text">
              <h4>물놀이 안전수칙</h4>
              <p>안전한 물놀이를 위한 수칙</p>
            </div>
            <span className="item-arrow">›</span>
          </div>
          <div className="learn-item" onClick={() => setLearnView("cpr")}>
            <span className="item-icon">❤️</span>
            <div className="item-text">
              <h4>심폐소생술</h4>
              <p>익수자 구조 후 응급처치</p>
            </div>
            <span className="item-arrow">›</span>
          </div>
        </div>
      </div>
    );
  }

  // 학습 상세
  function renderLearnDetail() {
    // 일반 콘텐츠
    if (typeof learnView === "string") {
      const content = LEARN_CONTENT[learnView];
      if (!content) return null;

      return (
        <div className="main-content">
          <div className="practice-header">
            <button className="back-btn" onClick={() => setLearnView(null)}>←</button>
            <h2>{content.title}</h2>
          </div>
          <div className="learn-detail">
            <div className="detail-header">
              <div className="detail-icon">{content.icon}</div>
              <h2>{content.title}</h2>
            </div>
            <div className="detail-section">
              <h3>개요</h3>
              <p style={{ whiteSpace: "pre-line" }}>{content.content}</p>
            </div>
            <div className="detail-section">
              <h3>핵심 포인트</h3>
              <ul className="checklist">
                {content.points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // 동작 상세
    const m = MOTIONS[learnView];
    if (!m) return null;

    return (
      <div className="main-content">
        <div className="practice-header">
          <button className="back-btn" onClick={() => setLearnView(null)}>←</button>
          <h2>{m.name}</h2>
        </div>
        <div className="learn-detail">
          <div className="detail-header">
            <div className="detail-icon">{m.icon}</div>
            <h2>{m.name}</h2>
            <p className="detail-sub">{m.sub}</p>
          </div>

          <div className="detail-section">
            <h3>동작 설명</h3>
            <p>{m.guide}</p>
          </div>

          <div className="detail-section">
            <h3>수행 방법</h3>
            <ul className="checklist">
              <li>{m.posture === "standing" ? "서서" : "앉아서"} 수행</li>
              {m.holdMode ? (
                <li>{m.holdGoal}초 유지하기</li>
              ) : (
                <li>{m.targetCycles}회 반복하기</li>
              )}
              {m.steps.slice(1).map((step, i) => (
                <li key={i}>{step} 자세 취하기</li>
              ))}
            </ul>
          </div>

          <button
            className="practice-btn"
            onClick={() => {
              setLearnView(null);
              setActiveTab("practice");
              setPracticeMode("select");
              setCurrentMotion(learnView);
              setHoldGoalInput(m.holdGoal || 30);
            }}
          >
            🏊 연습하러 가기
          </button>

          <div className="ref-links">
            <a href="https://www.safetv.go.kr" target="_blank" rel="noopener noreferrer">
              📺 안전한TV 교육영상 보기
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 연습 탭
  function renderPracticeTab() {
    // 카메라 활성 상태 (연습/녹화 중)
    if (practiceMode === "instant" || practiceMode === "knn" || practiceMode === "record") {
      return renderPracticeView();
    }

    // 동작 선택됨 - 모드 선택
    if (practiceMode === "select" && currentMotion) {
      return renderModeSelect();
    }

    // 기본 - 동작 선택
    return (
      <div className="main-content">
        <div className="page-header">
          <h1>🏊 연습</h1>
          <p>동작을 선택하여 연습을 시작하세요</p>
        </div>

        <div className="motion-select">
          <h2>동작 선택</h2>
          {Object.entries(MOTIONS).map(([id, m]) => {
            const clf = classifiersRef.current[id];
            const trained = (clf?.numClasses || 0) >= 2;

            return (
              <div
                key={id}
                className="motion-select-card"
                onClick={() => {
                  setCurrentMotion(parseInt(id));
                  setHoldGoalInput(m.holdGoal || 30);
                  setPracticeMode("select");
                }}
              >
                <div className="sel-icon">{m.icon}</div>
                <div className="sel-info">
                  <h3>{m.name}</h3>
                  <p>{m.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 모드 선택 화면
  function renderModeSelect() {
    const m = MOTIONS[currentMotion];
    const clf = classifiersRef.current[currentMotion];
    const trained = (clf?.numClasses || 0) >= 2;
    const total = clf?.totalSamples || 0;

    return (
      <div className="main-content">
        <div className="practice-header">
          <button className="back-btn" onClick={() => { setPracticeMode(null); setCurrentMotion(null); }}>←</button>
          <h2>{m.icon} {m.name}</h2>
        </div>

        <div className="motion-select" style={{ paddingTop: 10 }}>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 16 }}>
            {m.guide}
          </p>

          {/* 유지시간 설정 (holdMode만) */}
          {m.holdMode && (
            <div className="hold-slider">
              <label>⏱ 목표 유지 시간</label>
              <div className="slider-row">
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={holdGoalInput}
                  onChange={(e) => setHoldGoalInput(parseInt(e.target.value))}
                />
                <span className="slider-value">{holdGoalInput}초</span>
              </div>
            </div>
          )}

          <h2 style={{ marginTop: 20 }}>연습 모드 선택</h2>

          {/* 즉시 연습 */}
          <div
            className="motion-select-card"
            onClick={() => startPractice(currentMotion, "instant")}
          >
            <div className="sel-icon">⚡</div>
            <div className="sel-info">
              <h3>즉시 연습</h3>
              <p>학습 데이터 없이 바로 시작 (규칙 기반 피드백)</p>
            </div>
          </div>

          {/* KNN 연습 */}
          <div
            className="motion-select-card"
            style={{ opacity: trained ? 1 : 0.5 }}
            onClick={() => trained && startPractice(currentMotion, "knn")}
          >
            <div className="sel-icon">🤖</div>
            <div className="sel-info">
              <h3>AI 연습</h3>
              <p>
                {trained
                  ? `학습 데이터 기반 정밀 분석 (${total}개 샘플)`
                  : "학습 데이터가 필요합니다 (녹화 먼저)"}
              </p>
            </div>
          </div>

          {/* 녹화 모드 */}
          <div
            className="motion-select-card"
            onClick={() => {
              setSelectedStep(0);
              setPracticeMode("record");
              startCamera();
            }}
          >
            <div className="sel-icon">🎬</div>
            <div className="sel-info">
              <h3>녹화 모드</h3>
              <p>AI 학습을 위한 동작 데이터 수집</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 연습/녹화 뷰
  function renderPracticeView() {
    const m = currentMotion ? MOTIONS[currentMotion] : null;
    if (!m) return null;

    const session = sessionRef.current;
    const isRecord = practiceMode === "record";

    return (
      <div className="practice-view">
        {/* 헤더 */}
        <div className="practice-header">
          <button className="back-btn" onClick={exitPractice}>←</button>
          <h2>{m.icon} {m.name}</h2>
          <span className={`mode-badge ${isRecord ? "mode-record" : practiceMode === "knn" ? "mode-knn" : "mode-instant"}`}>
            {isRecord ? "녹화" : practiceMode === "knn" ? "AI" : "즉시"}
          </span>
        </div>

        {/* 카메라 영역 */}
        <div
          className={`camera-container ${session?.done ? "completed" : ""}`}
          ref={cameraContainerRef}
        >
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={canvasRef} />

          {/* FPS */}
          {cameraActive && <div className="fps-badge">FPS: {fps}</div>}

          {/* 유지시간 타이머 (holdMode 연습 시) */}
          {!isRecord && m.holdMode && session && session.holdSec > 0 && (
            <div className="hold-timer">
              <div className="hold-circle">
                <svg viewBox="0 0 106 106">
                  <circle cx="53" cy="53" r="46" stroke="var(--border)" />
                  <circle
                    cx="53"
                    cy="53"
                    r="46"
                    stroke="var(--accent)"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={
                      2 * Math.PI * 46 * (1 - Math.min(session.holdSec / session.customHoldGoal, 1))
                    }
                  />
                </svg>
                <span className="hold-time-text">{session.holdSec.toFixed(1)}</span>
              </div>
              <span className="hold-label">/ {session.customHoldGoal}초</span>
            </div>
          )}

          {/* 플래시 메시지 */}
          {flashRef.current.map((f) => (
            <div key={f.id} className="flash-msg">{f.msg}</div>
          ))}
        </div>

        {/* 녹화 패널 */}
        {isRecord && renderRecordPanel()}

        {/* 피드백 패널 */}
        {!isRecord && feedback && renderFeedbackPanel()}

        {/* 컨트롤 */}
        <div className="practice-controls">
          {isRecord ? (
            <>
              <button className="ctrl-btn primary" onClick={recordSample}>
                📷 녹화 (SPACE)
              </button>
              <button className="ctrl-btn secondary" onClick={exitPractice}>
                완료
              </button>
            </>
          ) : (
            <>
              <button
                className="ctrl-btn secondary"
                onClick={() => {
                  session?.reset();
                  feedbackHistoryRef.current.clear();
                  forceUpdate(n => n + 1);
                }}
              >
                ↺ 리셋
              </button>
              <button className="ctrl-btn secondary" onClick={exitPractice}>
                종료
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 녹화 패널
  function renderRecordPanel() {
    const m = MOTIONS[currentMotion];
    const clf = classifiersRef.current[currentMotion];
    const counts = clf?.getSampleCounts() || {};

    return (
      <div className="record-panel">
        <div className="step-selector">
          {m.steps.map((step, i) => {
            const cnt = counts[step] || 0;
            const isActive = i === selectedStep;
            let iconClass = "empty";
            if (isActive) iconClass = "recording";
            else if (cnt >= 10) iconClass = "ready";
            else if (cnt > 0) iconClass = "has-data";

            return (
              <button
                key={step}
                className={`step-btn ${isActive ? "active" : ""}`}
                onClick={() => setSelectedStep(i)}
              >
                <div className={`step-icon ${iconClass}`}>
                  {isActive ? "●" : cnt >= 10 ? "✓" : cnt || "·"}
                </div>
                <span className="step-name">{step}</span>
                <span className="step-count">{cnt}개</span>
              </button>
            );
          })}
        </div>
        <p className="record-info">
          자세를 취하고 <b style={{ color: "var(--accent)" }}>녹화</b> 버튼을 눌러 저장하세요.
          단계별 10~15개 권장.
        </p>
      </div>
    );
  }

  // 피드백 패널
  function renderFeedbackPanel() {
    if (!feedback) return null;

    const { checks, overallScore, summaryMessage, allPassed } = feedback;
    const radius = 25;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - overallScore / 100);

    return (
      <div className="feedback-panel">
        <div className="feedback-score">
          <div className={`score-circle ${allPassed ? "perfect" : ""}`}>
            <svg viewBox="0 0 62 62">
              <circle cx="31" cy="31" r={radius} stroke="var(--border)" />
              <circle
                cx="31"
                cy="31"
                r={radius}
                stroke={allPassed ? "var(--success)" : "var(--accent)"}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            {overallScore}%
          </div>
          <div className="feedback-message">
            <div className="main-msg" style={{ color: allPassed ? "var(--success)" : "var(--text)" }}>
              {summaryMessage}
            </div>
            <div className="sub-msg">
              {allPassed ? "자세를 유지하세요!" : "아래 체크포인트를 확인하세요"}
            </div>
          </div>
        </div>

        <div className="feedback-checks">
          {checks.map((check, i) => (
            <div key={i} className={`check-item ${check.passed ? "passed" : "failed"}`}>
              <span className="check-icon">{check.passed ? "✅" : "⚠️"}</span>
              <div className="check-text">
                <div className="check-name">{check.name}</div>
                <div className="check-msg">{check.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 기록 탭
  function renderHistoryTab() {
    const history = JSON.parse(localStorage.getItem("swim_history") || "[]");

    // 통계 계산
    const totalSessions = history.length;
    const totalMotions = new Set(history.map(h => h.motionId)).size;
    const avgScore = totalSessions > 0
      ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / totalSessions)
      : 0;

    return (
      <div className="main-content">
        <div className="page-header">
          <h1>📊 기록</h1>
          <p>연습 히스토리 및 통계</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{totalSessions}</div>
            <div className="stat-label">총 연습 횟수</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalMotions}</div>
            <div className="stat-label">연습한 동작</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{avgScore}</div>
            <div className="stat-label">평균 점수</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{history.filter(h => h.score >= 15).length}</div>
            <div className="stat-label">성공 횟수</div>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="history-empty">
            <div className="empty-icon">📝</div>
            <p>아직 연습 기록이 없습니다</p>
            <p style={{ marginTop: 8 }}>연습을 완료하면 여기에 기록됩니다</p>
          </div>
        ) : (
          <div className="history-list">
            {history.slice(0, 20).map((item) => {
              const m = MOTIONS[item.motionId];
              const date = new Date(item.date);
              return (
                <div key={item.id} className="history-item">
                  <div className="hist-header">
                    <span className="hist-icon">{m?.icon || "🏊"}</span>
                    <div className="hist-title">
                      <h4>{m?.name || "알 수 없음"}</h4>
                      <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
                    </div>
                    <span className="hist-score">{item.score}/20</span>
                  </div>
                  <div className="hist-details">
                    {item.holdSec > 0 && <span>유지시간: {item.holdSec.toFixed(1)}초</span>}
                    {item.cycles > 0 && <span>사이클: {item.cycles}회</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // 설정 탭
  function renderSettingsTab() {
    return (
      <div className="main-content">
        <div className="page-header">
          <h1>⚙️ 설정</h1>
          <p>앱 설정 및 데이터 관리</p>
        </div>

        {/* 카메라 설정 */}
        <div className="settings-section">
          <h3>카메라 설정</h3>
          <div className="setting-item">
            <span className="setting-icon">📷</span>
            <div className="setting-text">
              <h4>카메라 선택</h4>
              <p>사용할 카메라를 선택하세요</p>
            </div>
          </div>
          <select
            value={selectedCameraId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedCameraId(newId);
              localStorage.setItem("swim_camera_id", newId);
              showToast("카메라가 변경되었습니다");
            }}
            style={{
              width: "100%",
              padding: "12px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: "14px",
              marginTop: "8px",
              cursor: "pointer",
            }}
          >
            {cameras.length === 0 ? (
              <option value="">카메라를 찾는 중...</option>
            ) : (
              cameras.map((cam, idx) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `카메라 ${idx + 1}`}
                </option>
              ))
            )}
          </select>
          <button
            className="setting-btn"
            style={{ marginTop: "12px" }}
            onClick={loadCameras}
          >
            🔄 카메라 목록 새로고침
          </button>
        </div>

        {/* 데이터 관리 */}
        <div className="settings-section">
          <h3>학습 데이터</h3>
          {Object.entries(MOTIONS).map(([id, m]) => {
            const clf = classifiersRef.current[id];
            const counts = clf?.getSampleCounts() || {};
            const total = clf?.totalSamples || 0;

            return (
              <div key={id} className="data-motion">
                <div className="dm-header">
                  <span className="dm-icon">{m.icon}</span>
                  <span className="dm-name">{m.name}</span>
                  <span className="dm-total">{total}개</span>
                </div>
                <div className="dm-steps">
                  {m.steps.map((step) => {
                    const cnt = counts[step] || 0;
                    return (
                      <div key={step} className="dm-step">
                        <span className="step-name">{step}</span>
                        <div className="step-bar">
                          <div
                            className="step-bar-fill"
                            style={{
                              width: `${Math.min((cnt / 15) * 100, 100)}%`,
                              background: cnt >= 10 ? "var(--success)" : cnt > 0 ? "var(--warning)" : "var(--border)"
                            }}
                          />
                        </div>
                        <span className="step-count">{cnt}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="dm-actions">
                  <button
                    onClick={() => {
                      const data = clf?.export();
                      if (data) {
                        const blob = new Blob([data], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `swim_knn_${id}.json`;
                        a.click();
                        showToast("내보내기 완료");
                      }
                    }}
                  >
                    내보내기
                  </button>
                  <button
                    className="delete"
                    onClick={() => {
                      if (confirm(`${m.name}의 모든 학습 데이터를 삭제할까요?`)) {
                        clf?.clear();
                        localStorage.removeItem(`swim_knn_${id}`);
                        showToast("삭제 완료");
                        forceUpdate(n => n + 1);
                      }
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 전체 작업 */}
        <div className="settings-section">
          <h3>전체 데이터</h3>
          <button
            className="setting-btn"
            onClick={() => {
              const allData = {};
              for (let i = 1; i <= 6; i++) {
                const d = localStorage.getItem(`swim_knn_${i}`);
                if (d) allData[`swim_knn_${i}`] = d;
              }
              allData.swim_history = localStorage.getItem("swim_history") || "[]";

              const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `swim_trainer_backup_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              showToast("전체 백업 완료");
            }}
          >
            📤 전체 내보내기
          </button>

          <button
            className="setting-btn"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target.result);
                    for (const key in data) {
                      localStorage.setItem(key, typeof data[key] === "string" ? data[key] : JSON.stringify(data[key]));
                    }
                    // 분류기 다시 로드
                    for (let i = 1; i <= 6; i++) {
                      const saved = localStorage.getItem(`swim_knn_${i}`);
                      if (saved) {
                        classifiersRef.current[i].import(saved);
                      }
                    }
                    showToast("가져오기 완료");
                    forceUpdate(n => n + 1);
                  } catch (err) {
                    showToast("파일 형식 오류", "error");
                  }
                };
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            📥 가져오기
          </button>

          <button
            className="setting-btn danger"
            onClick={() => {
              if (confirm("모든 데이터(학습 데이터 + 연습 기록)를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.")) {
                for (let i = 1; i <= 6; i++) {
                  localStorage.removeItem(`swim_knn_${i}`);
                  classifiersRef.current[i]?.clear();
                }
                localStorage.removeItem("swim_history");
                showToast("전체 삭제 완료");
                forceUpdate(n => n + 1);
              }
            }}
          >
            🗑 전체 삭제
          </button>
        </div>

        {/* 앱 정보 */}
        <div className="settings-section">
          <h3>앱 정보</h3>
          <div className="setting-item">
            <span className="setting-icon">🏊</span>
            <div className="setting-text">
              <h4>생존수영 트레이너</h4>
              <p>MediaPipe + KNN 기반 실시간 동작 분석</p>
            </div>
          </div>
          <div className="setting-item">
            <span className="setting-icon">💾</span>
            <div className="setting-text">
              <h4>데이터 저장</h4>
              <p>브라우저 localStorage (서버 저장 없음)</p>
            </div>
          </div>
          <div className="setting-item">
            <span className="setting-icon">{modelReady ? "✅" : "⏳"}</span>
            <div className="setting-text">
              <h4>AI 모델</h4>
              <p>{modelReady ? "준비 완료" : "로딩 중..."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 메인 렌더
  // ═══════════════════════════════════════════════════════════
  // 연습/녹화 중일 때는 탭바 숨김
  const showTabBar = !(practiceMode === "instant" || practiceMode === "knn" || practiceMode === "record");

  return (
    <div className="app-frame">
      {/* 메인 콘텐츠 */}
      {activeTab === "home" && renderHomeTab()}
      {activeTab === "learn" && renderLearnTab()}
      {activeTab === "practice" && renderPracticeTab()}
      {activeTab === "history" && renderHistoryTab()}
      {activeTab === "settings" && renderSettingsTab()}

      {/* 하단 탭 바 */}
      {showTabBar && (
        <nav className="tab-bar">
          <button
            className={`tab-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <span className="tab-icon">🏠</span>
            <span className="tab-label">홈</span>
          </button>
          <button
            className={`tab-item ${activeTab === "learn" ? "active" : ""}`}
            onClick={() => { setActiveTab("learn"); setLearnView(null); }}
          >
            <span className="tab-icon">📖</span>
            <span className="tab-label">학습</span>
          </button>
          <button
            className={`tab-item ${activeTab === "practice" ? "active" : ""}`}
            onClick={() => { setActiveTab("practice"); setPracticeMode(null); setCurrentMotion(null); }}
          >
            <span className="tab-icon">🏊</span>
            <span className="tab-label">연습</span>
          </button>
          <button
            className={`tab-item ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">기록</span>
          </button>
          <button
            className={`tab-item ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">설정</span>
          </button>
        </nav>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
