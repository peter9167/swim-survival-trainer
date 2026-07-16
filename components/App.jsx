"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MOTIONS } from "@/lib/motions";
import { extractFeatures } from "@/lib/features";
import { KNNClassifier } from "@/lib/knn";
import { PracticeSession } from "@/lib/session";
import { evaluatePose, FeedbackHistory } from "@/lib/feedback";
import { StageSkeleton } from "@/lib/skeletonIcons";
import { LEARN_CONTENT } from "@/lib/learn";
import { ICONS, FontAwesomeIcon } from "@/lib/icons";
import { OceanMap } from "@/components/OceanMap";
import { LearnContent } from "@/components/LearnContent";
import { Mascot, MascotBubble } from "@/components/Mascot";
import {
  getSchools,
  createSchool,
  verifyAdminPassword,
  saveTrainingData,
  deleteTrainingData,
  deleteAllTrainingDataBySchool,
  loginAdmin,
  unifiedLogin,
  listAdmins,
  createSubAdmin,
  deleteAdmin,
  updateAdminPassword,
  listSchoolsWithSecrets,
  deleteSchool,
  updateSchoolPassword,
  DEFAULT_SCHOOL_ID,
} from "@/lib/supabase";

// 스켈레톤 연결선
const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export default function App() {
  // 탭 상태 (sessionStorage에서 복원)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("swim_tab");
      // 삭제된 탭이면 practice로 리다이렉트
      if (saved === "home" || saved === "history") return "practice";
      return saved || "practice";
    }
    return "practice";
  });

  // 연습/녹화 상태
  const [practiceMode, setPracticeMode] = useState(null);
  const [currentMotion, setCurrentMotion] = useState(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [holdGoalInput, setHoldGoalInput] = useState(30);
  const [cycleGoalInput, setCycleGoalInput] = useState(5);

  // 학습 상태 (sessionStorage에서 복원)
  const [learnView, setLearnView] = useState(() => {
    if (typeof window !== "undefined") {
      const v = sessionStorage.getItem("swim_learn");
      if (v) {
        const n = parseInt(v);
        return isNaN(n) ? v : n; // 숫자면 motionId, 아니면 문자열("intro" 등)
      }
    }
    return null;
  });

  // 카메라/AI 상태
  const [cameraActive, setCameraActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [practiceComplete, setPracticeComplete] = useState(null); // 완료 결과 {motionId, holdSec, cycles, score}
  const [countdown, setCountdown] = useState(0); // 3,2,1 카운트다운
  const [, forceUpdate] = useState(0);

  // 카메라 선택
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swim_camera_id") || "";
    }
    return "";
  });
  // 학교/관리자 상태
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("swim_school_id") || "";
    }
    return "";
  });
  const [isAdmin, setIsAdmin] = useState(false); // 학교 관리자 여부 (레거시)
  const [dataLoading, setDataLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // ═══ 시스템 관리자 (root / sub) ═══
  const [currentAdmin, setCurrentAdmin] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = sessionStorage.getItem("swim_current_admin");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const isRoot = currentAdmin?.role === "root";
  const isSubAdmin = currentAdmin?.role === "sub";
  const isSystemAdmin = currentAdmin != null; // root or sub
  // 학교 관리 등 일반 관리 권한 (학교 관리자 or 시스템 관리자)
  const hasAdminPower = isAdmin || isSystemAdmin;
  // 학습 데이터 조작 권한 (root or 학교 관리자만) — sub는 제외
  const canManageTrainingData = isRoot || isAdmin;

  // 관리자 관리 상태 (root 전용)
  const [adminList, setAdminList] = useState([]);
  const [showAdminList, setShowAdminList] = useState(false);
  const [showAdminPasswords, setShowAdminPasswords] = useState(false);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  // 학교 계정 관리 상태 (root + sub-admin)
  const [schoolAdminList, setSchoolAdminList] = useState([]);
  const [showSchoolList, setShowSchoolList] = useState(false);
  const [showSchoolPasswords, setShowSchoolPasswords] = useState(false);

  // 설정 탭 서브탭
  const [settingsTab, setSettingsTab] = useState(() => {
    if (typeof window === "undefined") return "account";
    return sessionStorage.getItem("swim_settings_tab") || "account";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("swim_settings_tab", settingsTab);
  }, [settingsTab]);

  // 로그인 모달 (신규)
  const [loginModal, setLoginModal] = useState(null); // null | "system" | "school"
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // currentAdmin 변경시 sessionStorage 동기화
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentAdmin) {
      sessionStorage.setItem("swim_current_admin", JSON.stringify(currentAdmin));
    } else {
      sessionStorage.removeItem("swim_current_admin");
    }
  }, [currentAdmin]);

  // 통합 로그인 — 아이디 하나로 시스템/학교 자동 판별
  async function handleUnifiedLogin() {
    if (!loginUsername || !loginPassword) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const result = await unifiedLogin(loginUsername.trim(), loginPassword);
      if (!result) {
        setLoginError("아이디 또는 비밀번호가 올바르지 않습니다");
        return;
      }

      if (result.kind === "admin") {
        setCurrentAdmin(result.admin);
        setLoginModal(null);
        setLoginUsername("");
        setLoginPassword("");
        const roleLabel = result.admin.role === "root" ? "최고 관리자" : "서브 관리자";
        showToast(`${roleLabel}로 로그인`);
      } else if (result.kind === "school") {
        // 학교 관리자 로그인 — 컨텍스트도 그 학교로 자동 세팅
        setIsAdmin(true);
        setSelectedSchoolId(result.school.id);
        localStorage.setItem("swim_school_id", result.school.id);
        setLoginModal(null);
        setLoginUsername("");
        setLoginPassword("");
        showToast(`${result.school.name} 관리자로 로그인`);
        // 그 학교 데이터 로드
        await handleSchoolSelect(result.school.id, { preserveAdmin: true });
      }
    } catch (err) {
      setLoginError(err.message || "로그인 오류");
    } finally {
      setLoginBusy(false);
    }
  }

  // 시스템 관리자 로그아웃
  function handleSystemLogout() {
    setCurrentAdmin(null);
    setShowAdminList(false);
    setShowAdminPasswords(false);
    setAdminList([]);
    showToast("로그아웃");
  }

  // 관리자 목록 로드 (root 전용)
  async function loadAdminList() {
    if (!isRoot) return;
    try {
      const list = await listAdmins();
      setAdminList(list);
    } catch (err) {
      showToast("관리자 목록 로드 실패", "error");
    }
  }

  // 서브 관리자 생성
  async function handleCreateSubAdmin() {
    if (!isRoot) return;
    if (!newAdminUsername || !newAdminPassword) return;
    try {
      await createSubAdmin(newAdminUsername.trim(), newAdminPassword, currentAdmin.id);
      setNewAdminUsername("");
      setNewAdminPassword("");
      showToast("서브 관리자 생성 완료");
      await loadAdminList();
    } catch (err) {
      showToast(err.message || "생성 실패", "error");
    }
  }

  // 관리자 삭제
  async function handleDeleteAdmin(adminId, username) {
    if (!isRoot) return;
    const ok = await showModal({
      title: "관리자 삭제",
      message: `'${username}' 계정을 삭제할까요? 되돌릴 수 없습니다.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAdmin(adminId);
      showToast("삭제 완료");
      await loadAdminList();
    } catch (err) {
      showToast(err.message || "삭제 실패", "error");
    }
  }

  // 학교 목록 로드 (root + sub)
  async function loadSchoolAdminList() {
    if (!isSystemAdmin) return;
    try {
      const list = await listSchoolsWithSecrets();
      setSchoolAdminList(list);
    } catch (err) {
      showToast("학교 목록 로드 실패", "error");
    }
  }

  // 학교 삭제 (root + sub)
  async function handleDeleteSchool(schoolId, name) {
    if (!isSystemAdmin) return;
    if (schoolId === DEFAULT_SCHOOL_ID) {
      showToast("기본 학교는 삭제할 수 없습니다", "error");
      return;
    }
    const ok = await showModal({
      title: "학교 삭제",
      message: `'${name}' 학교와 그 학습 데이터가 모두 삭제됩니다.\n되돌릴 수 없습니다. 계속할까요?`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSchool(schoolId);
      // 현재 선택된 학교였다면 선택 해제
      if (selectedSchoolId === schoolId) {
        setSelectedSchoolId("");
        localStorage.removeItem("swim_school_id");
      }
      showToast("학교 삭제 완료");
      await loadSchoolAdminList();
      // 상단 학교 select 갱신
      try { setSchools(await getSchools()); } catch {}
    } catch (err) {
      showToast(err.message || "삭제 실패", "error");
    }
  }

  // 학교 비밀번호 변경 (root + sub)
  async function handleUpdateSchoolPassword(schoolId, name) {
    if (!isSystemAdmin) return;
    const result = await showModal({
      type: "prompt",
      title: `${name} 비밀번호 변경`,
      message: "새 비밀번호를 입력하세요 (4자 이상)",
      placeholder: "새 비밀번호",
    });
    if (!result) return;
    try {
      await updateSchoolPassword(schoolId, result);
      showToast("비밀번호 변경 완료");
      await loadSchoolAdminList();
    } catch (err) {
      showToast(err.message || "변경 실패", "error");
    }
  }

  // 피드백 상태
  const [feedback, setFeedback] = useState(null);

  // 모달
  const [modal, setModal] = useState(null);
  const modalResolveRef = useRef(null);

  // 오버레이 dismiss — mousedown이 오버레이에서 시작한 경우에만 닫힘
  // (input 드래그 중 mouseup이 오버레이로 나가서 실수로 닫히는 버그 방지)
  const overlayMouseDownRef = useRef(false);
  function overlayDismissHandlers(closeFn) {
    return {
      onMouseDown: (e) => {
        overlayMouseDownRef.current = e.target === e.currentTarget;
      },
      onClick: (e) => {
        if (overlayMouseDownRef.current && e.target === e.currentTarget) {
          closeFn();
        }
        overlayMouseDownRef.current = false;
      },
    };
  }

  // 토스트
  const [toast, setToast] = useState(null);

  // 자세 미리보기
  const [previewImage, setPreviewImage] = useState(null);

  // ═══ UI 스케일 (대형 터치 모니터 대응) ═══
  // null = 자동 감지 (JS로 뷰포트+DPR+터치 계산), 숫자 = 사용자 오버라이드
  const [uiScale, setUiScale] = useState(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem("swim_ui_scale");
    return v ? parseFloat(v) : null;
  });
  const [autoScale, setAutoScale] = useState(1);

  // 이 모니터에 맞춘 최적 스케일 자동 감지
  // - 뷰포트 너비 (가장 강한 신호)
  // - DPR (고DPI 화면에서 물리적 크기 보정)
  // - 터치 여부 (터치 = 조작 여유 필요)
  function detectScale() {
    if (typeof window === "undefined") return 1;
    const w = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    const isTouch = window.matchMedia && (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches
    );

    // 뷰포트 기반 기본 스케일
    // 1024px → 1.0 / 1440px → 1.2 / 1920px → 1.45 / 2560px → 1.7 / 3840px → 1.85
    let scale = 1 + Math.max(0, (w - 1024) / 3800);

    // 고DPR 화면 보정 (같은 인치라도 CSS px는 작아 보임)
    if (dpr >= 2) scale *= 1.05;
    if (dpr >= 3) scale *= 1.05;

    // 터치 기기는 +10% (손가락 조작 여유)
    if (isTouch) scale *= 1.1;

    // 상하한 클램프
    return Math.max(0.9, Math.min(2.0, Math.round(scale * 100) / 100));
  }

  // 오버라이드 or 자동 감지 결과를 :root의 --fs-scale에 적용
  useEffect(() => {
    if (typeof document === "undefined") return;

    const applyScale = () => {
      if (uiScale != null) {
        document.documentElement.style.setProperty("--fs-scale", String(uiScale));
      } else {
        const s = detectScale();
        setAutoScale(s);
        document.documentElement.style.setProperty("--fs-scale", String(s));
      }
    };

    applyScale();

    // 사용자 오버라이드 저장 상태 동기화
    if (uiScale == null) localStorage.removeItem("swim_ui_scale");
    else localStorage.setItem("swim_ui_scale", String(uiScale));

    // 창 크기 변경 시 자동 재감지 (오버라이드 없을 때만)
    const onResize = () => {
      if (uiScale == null) applyScale();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [uiScale]);

  // 표시용 현재 배율
  const effectiveScale = uiScale ?? autoScale;

  // ± 조작 (0.1 스텝, 0.8~2.2 범위)
  const bumpScale = (delta) => {
    const base = uiScale ?? effectiveScale;
    const next = Math.max(0.8, Math.min(2.2, Math.round((base + delta) * 100) / 100));
    setUiScale(next);
  };

  // "이 모니터에 맞추기" — 자동 감지 결과를 저장 (오버라이드로 고정)
  const fitToScreen = () => {
    const s = detectScale();
    setUiScale(s);
  };

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
  const practiceModeRef = useRef(practiceMode);
  const currentMotionRef = useRef(currentMotion);
  const graceStartRef = useRef(null); // 유예 시간 시작 시점
  const countdownRef = useRef(0);
  const feedbackRef = useRef(null); // 피드백 ref (매 프레임 업데이트)
  const lastUIUpdateRef = useRef(0); // UI 업데이트 쓰로틀 타이머
  const UI_THROTTLE_MS = 150; // UI 업데이트 간격 (ms)

  // refs를 최신 상태로 동기화 (mainLoop 스테일 클로저 방지)
  practiceModeRef.current = practiceMode;
  currentMotionRef.current = currentMotion;

  // sessionStorage에 네비게이션 상태 저장
  useEffect(() => {
    sessionStorage.setItem("swim_tab", activeTab);
    if (learnView != null) sessionStorage.setItem("swim_learn", String(learnView));
    else sessionStorage.removeItem("swim_learn");
  }, [activeTab, learnView]);

  // ═══════════════════════════════════════════════════════════
  // 초기화
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    async function init() {
      // KNN 분류기 초기화
      for (let i = 1; i <= 6; i++) {
        classifiersRef.current[i] = new KNNClassifier(5);
      }

      // 학교 목록 로드
      try {
        const schoolList = await getSchools();
        setSchools(schoolList);
      } catch (err) {
        console.error("Failed to load schools:", err);
      }

      // Supabase에서 학습 데이터 로드 (동작별 + step name 라벨)
      const savedSchoolId = localStorage.getItem("swim_school_id") || "";
      try {
        for (let i = 1; i <= 6; i++) {
          await classifiersRef.current[i].loadFromSupabase(
            i.toString(), MOTIONS[i].steps, savedSchoolId || null
          );
        }
        console.log("Training data loaded from Supabase");
      } catch (err) {
        console.error("Failed to load training data:", err);
      }

      // Supabase 데이터가 없는 동작만 localStorage에서 병합
      mergeLocalStorage();
      setDataLoading(false);

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

  async function startCamera() {
    if (streamRef.current) return;
    try {
      // 카메라 목록이 없으면 먼저 로드
      if (cameras.length === 0) {
        await loadCameras();
      }
      // 16:9 해상도 선호 (카메라가 지원하면 사용, 아니면 가능한 해상도 사용)
      const videoConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        ...(selectedCameraId
          ? { deviceId: { exact: selectedCameraId } }
          : { facingMode: "user" }),
      };
      const constraints = { video: videoConstraints };
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

      const pm = practiceModeRef.current;
      const cm = currentMotionRef.current;

      // 대기 또는 카운트다운 중이면 피드백 처리 건너뛰기
      if (countdownRef.current !== 0) return;

      // 즉시 연습 모드 또는 KNN 모드: 규칙 기반 피드백은 항상 실행
      if ((pm === "instant" || pm === "knn") && cm) {
        const fb = evaluatePose(cm, lms, feedbackHistoryRef.current);
        feedbackRef.current = fb;

        const session = sessionRef.current;
        let needsUIUpdate = false;

        if (pm === "instant") {
          const GRACE_MS = 500; // 0.5초 유예

          if (session && session.motion.holdStages && !session.guideStageDone) {
            // ── 가이드 단계 진행 중 ──
            const stageIdx = session.guideStageIdx;
            const checksUpToCurrent = fb.checks.slice(0, stageIdx + 1);
            const allUpToCurrent = checksUpToCurrent.every(c => c.passed);

            session.updateGuideStageConfirm(allUpToCurrent, timestamp / 1000);

            if (allUpToCurrent && session.guideStageConfirmSec >= session.currentGuideStage.confirmSec) {
              session.advanceGuideStage();
              if (session.flashMsg && performance.now() - session.flashTime < 100) {
                addFlash(session.flashMsg);
                session.flashMsg = "";
              }
              // guideStageDone이 되면 graceStart 리셋
              if (session.guideStageDone) {
                graceStartRef.current = null;
              }
            }
            needsUIUpdate = true;
          } else if (session && session.motion.guidedCycles && fb.phase) {
            // ── 순차 확인 사이클 (스컬링: 벌리기→모으기 = 1회) ──
            graceStartRef.current = null;
            session.updateGuidedCycle(fb.phase, timestamp / 1000);
            if (session.flashMsg && performance.now() - session.flashTime < 100) {
              addFlash(session.flashMsg);
              session.flashMsg = "";
            }
            needsUIUpdate = true;
          } else if (session && session.motion.guidedCycles && !fb.phase) {
            // 순차 확인 동작인데 phase 없음 (전환 중) → 타이머 리셋만
            session.guidedPhaseConfirmStart = null;
            session.guidedPhaseConfirmSec = 0;
            needsUIUpdate = true;
          } else if (session && session.motion.instantGoal) {
            // ── 시퀀스 동작 즉시 모드: 자세 체크만 통과하면 누적 ──
            const coreChecks = fb.checks.filter(c => c.priority <= 2);
            const corePassed = coreChecks.length > 0 && coreChecks.every(c => c.passed);
            if (corePassed) {
              graceStartRef.current = null;
              session.updateInstantHold(timestamp / 1000);
            } else {
              // 자세 미달: 시간 누적 일시정지 (리셋하지 않음)
              session.holdStart = null;
            }
            if (session.flashMsg && performance.now() - session.flashTime < 100) {
              addFlash(session.flashMsg);
              session.flashMsg = "";
            }
            needsUIUpdate = true;
          } else if (session && fb.allPassed) {
            // ── 전체 체크 통과 (가이드 완료 후 최종 유지 또는 비가이드) ──
            graceStartRef.current = null;
            session.update(session.motion.sequence[0] || "완료", 1.0, timestamp / 1000);
            if (session.flashMsg && performance.now() - session.flashTime < 100) {
              addFlash(session.flashMsg);
              session.flashMsg = "";
            }
            needsUIUpdate = true;
          } else if (session) {
            // ── 체크 미통과 → 유예 시간 처리 ──
            const now = performance.now();
            if (!graceStartRef.current) {
              graceStartRef.current = now;
            }
            if (now - graceStartRef.current > GRACE_MS) {
              // 최종 유지 단계에서만 holdSec 리셋
              if (session.guideStageDone || !session.motion.holdStages) {
                session.holdStart = null;
                session.holdSec = 0;
              }
              needsUIUpdate = true;
            }
          }
        } else if (pm === "knn") {
          // KNN 모드: AI 분류 + 규칙 피드백 병행
          const clf = classifiersRef.current[cm];
          if (session && clf && clf.numClasses >= 2) {
            const features = extractFeatures(lms);
            const { label, confidence } = clf.predict(features);

            if (session.motion.guidedCycles) {
              // guidedCycles 동작: KNN 예측 label을 phase로 사용
              const seq = session.motion.sequence;
              if (confidence > 0.45 && seq.includes(label)) {
                session.updateGuidedCycle(label, timestamp / 1000);
              } else {
                // 낮은 신뢰도 또는 준비자세 → 확인 타이머 리셋
                session.guidedPhaseConfirmStart = null;
                session.guidedPhaseConfirmSec = 0;
              }
            } else {
              session.update(label, confidence, timestamp / 1000);
            }

            if (session.flashMsg && performance.now() - session.flashTime < 100) {
              addFlash(session.flashMsg);
              session.flashMsg = "";
            }
          }
          needsUIUpdate = true;
        }

        // 목표 달성 감지 → 카메라 정지 + 완료 화면
        if (session && session.done) {
          const m = MOTIONS[cm];
          saveHistory(session);
          // RAF 중단 (카메라 인식 정지)
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          // 진동 피드백 (모바일)
          if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
          setPracticeComplete({
            motionId: cm,
            motionName: m.name,
            motionIcon: m.icon,
            holdSec: session.holdSec,
            cycles: session.cyclesDone,
            targetCycles: m.targetCycles,
            holdGoal: session.customHoldGoal,
            score: session.score,
            holdMode: !!m.holdMode,
            instantGoal: !!m.instantGoal,
          });
          setFeedback(feedbackRef.current);
          forceUpdate(n => n + 1);
          return; // 루프 종료
        }

        // UI 업데이트 쓰로틀: 150ms 간격으로만 React 리렌더링
        const now = performance.now();
        if (needsUIUpdate && now - lastUIUpdateRef.current >= UI_THROTTLE_MS) {
          lastUIUpdateRef.current = now;
          setFeedback(feedbackRef.current);
          forceUpdate(n => n + 1);
        }
      }
    } else {
      lastPoseRef.current = null;
      if (feedbackRef.current !== null) {
        feedbackRef.current = null;
        setFeedback(null);
      }
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 스켈레톤 그리기
  // ═══════════════════════════════════════════════════════════
  function drawSkeleton(ctx, lms, cw, ch, vw, vh) {
    // object-fit: contain과 동일하게 Math.min 사용
    const scale = Math.min(cw / vw, ch / vh);
    const ox = (cw - vw * scale) / 2;
    const oy = (ch - vh * scale) / 2;

    function toScreen(lm) {
      // 좌우반전 (거울 모드)
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

  // ── 커스텀 모달 ──
  // type: "confirm" | "prompt" | "prompt2" (입력 2개)
  function showModal({ type = "confirm", title, message, placeholder, placeholder2, danger }) {
    return new Promise((resolve) => {
      modalResolveRef.current = resolve;
      setModal({ type, title, message, placeholder, placeholder2, danger, inputVal: "", inputVal2: "" });
    });
  }

  function closeModal(result) {
    modalResolveRef.current?.(result);
    modalResolveRef.current = null;
    setModal(null);
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

  // 녹화 세션 중 새로 추가된 샘플 추적 (저장 버튼 시 일괄 업로드용)
  const recordedSamplesRef = useRef([]);

  function recordSample() {
    if (!lastPoseRef.current || !currentMotion) return;
    const m = MOTIONS[currentMotion];
    const stepName = m.steps[selectedStep];
    const features = extractFeatures(lastPoseRef.current);
    const clf = classifiersRef.current[currentMotion];

    // 로컬 KNN에 즉시 추가 (실시간 확인용)
    clf.addSample(stepName, features);
    localStorage.setItem(`swim_knn_${currentMotion}`, clf.export());

    // 학습 데이터 권한자만 서버 업로드 대상 기록 (sub-admin 제외)
    // selectedSchoolId 없으면 DEFAULT(root) 컨텍스트로 저장
    if (canManageTrainingData) {
      recordedSamplesRef.current.push({
        motionId: currentMotion.toString(),
        stepIndex: selectedStep,
        features: [...features],
      });
    }

    const cnt = clf.getSampleCounts()[stepName] || 0;
    addFlash(`${stepName} 녹화! (${cnt}개)`);
    forceUpdate(n => n + 1);
  }

  async function saveRecordedSamples() {
    const samples = recordedSamplesRef.current;
    if (!samples.length) {
      exitPractice();
      return;
    }
    // 학교 없으면 root 컨텍스트(DEFAULT_SCHOOL_ID)로 저장
    const targetSchoolId = selectedSchoolId || DEFAULT_SCHOOL_ID;

    const total = samples.length;
    setLoadingMsg(`업로드 중... 0/${total}`);
    setDataLoading(true);

    let uploaded = 0;
    let failed = 0;
    for (const s of samples) {
      try {
        await saveTrainingData(s.motionId, s.stepIndex, s.features, targetSchoolId);
        uploaded++;
      } catch {
        failed++;
      }
      if (uploaded % 3 === 0 || uploaded + failed === total) {
        setLoadingMsg(`업로드 중... ${uploaded + failed}/${total}`);
      }
    }

    setDataLoading(false);
    setLoadingMsg("");
    recordedSamplesRef.current = [];

    if (failed > 0) {
      showToast(`${uploaded}개 저장 완료, ${failed}개 실패`, "error");
    } else {
      showToast(`${uploaded}개 저장 완료`);
    }
    exitPractice();
  }

  async function deleteLabel(stepName) {
    const clf = classifiersRef.current[currentMotion];
    if (!clf) return;
    const cnt = clf.getSampleCounts()[stepName] || 0;
    const ok = await showModal({ title: "데이터 삭제", message: `"${stepName}" 데이터 ${cnt}개를 삭제할까요?`, danger: true });
    if (!ok) return;
    clf.clearLabel(stepName);
    localStorage.setItem(`swim_knn_${currentMotion}`, clf.export());
    showToast(`${stepName} 데이터 삭제됨`);
    forceUpdate(n => n + 1);
  }

  // ── 키보드 단축키 (SPACE: 녹화, ESC: 종료) ──
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && modal) {
        closeModal(false);
        return;
      }
      if (e.key === "Escape" && previewImage) {
        setPreviewImage(null);
        return;
      }
      if (practiceMode === "record") {
        if (e.code === "Space") {
          e.preventDefault();
          recordSample();
        } else if (e.key === "Escape") {
          exitPractice();
        }
      } else if (practiceMode === "instant" || practiceMode === "knn") {
        if (e.key === "Escape") {
          exitPractice();
        }
      } else if (e.key === "Escape" && learnView != null) {
        setLearnView(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [practiceMode, currentMotion, selectedStep, previewImage, modal, learnView]);

  function startPractice(motionId, mode) {
    setCurrentMotion(motionId);
    const m = MOTIONS[motionId];
    const goal = m.holdMode ? holdGoalInput : null;
    const cycles = m.guidedCycles ? cycleGoalInput : null;
    sessionRef.current = new PracticeSession(motionId, goal, cycles);
    feedbackHistoryRef.current.clear();
    setPracticeMode(mode);
    startCamera();

    if (mode === "record") {
      // 녹화 모드: 바로 시작
      recordedSamplesRef.current = [];
      countdownRef.current = 0;
      setCountdown(0);
    } else {
      // 즉시/AI 모드: 시작 버튼 대기 상태
      countdownRef.current = -1;
      setCountdown(-1);
    }
  }

  function beginCountdown() {
    // 시작 시점의 최신 설정으로 세션 재생성
    const m = MOTIONS[currentMotion];
    const goal = m.holdMode ? holdGoalInput : null;
    const cycles = m.guidedCycles ? cycleGoalInput : null;
    sessionRef.current = new PracticeSession(currentMotion, goal, cycles);
    feedbackHistoryRef.current.clear();

    countdownRef.current = 3;
    setCountdown(3);
    const tick = setInterval(() => {
      countdownRef.current--;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        clearInterval(tick);
      }
    }, 1000);
  }

  function exitPractice() {
    const wasRecord = practiceMode === "record";
    stopCamera();
    countdownRef.current = 0;
    setCountdown(0);
    sessionRef.current = null;
    setFeedback(null);
    feedbackRef.current = null;
    feedbackHistoryRef.current.clear();
    setPracticeComplete(null);
    if (wasRecord) {
      // 녹화 모드는 설정에서 진입했으므로 설정으로 돌아감
      setPracticeMode(null);
      setCurrentMotion(null);
      setActiveTab("settings");
    } else {
      // 연습 모드는 동작 목록으로 돌아감
      setPracticeMode(null);
      setCurrentMotion(null);
    }
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

  // 학습 탭
  function renderLearnTab() {
    if (learnView) {
      return renderLearnDetail();
    }

    // 완료 상태: localStorage에서 로드
    const completed = new Set(
      JSON.parse(typeof window !== "undefined" ? localStorage.getItem("swim_learn_done") || "[]" : "[]")
    );

    return (
      <div className="main-content main-content-map">
        <OceanMap
          completed={completed}
          onSelect={(item) => {
            if (item.type === "motion") setLearnView(item.id);
            else setLearnView(item.id);
          }}
        />
      </div>
    );
  }

  // 콘텐츠 완료 마킹
  function markLearnDone(key) {
    if (typeof window === "undefined") return;
    const set = new Set(JSON.parse(localStorage.getItem("swim_learn_done") || "[]"));
    set.add(key);
    localStorage.setItem("swim_learn_done", JSON.stringify([...set]));
    forceUpdate(n => n + 1);
  }

  // 학습 상세
  function renderLearnDetail() {
    // 일반 콘텐츠 (intro/safety/cpr/이안류/저류/위험지형) — 새 컴포넌트
    if (typeof learnView === "string") {
      return (
        <div className="main-content main-content-detail">
          <LearnContent
            contentId={learnView}
            onBack={() => setLearnView(null)}
            onComplete={() => markLearnDone(`content-${learnView}`)}
          />
        </div>
      );
    }

    // 동작 상세
    const m = MOTIONS[learnView];
    if (!m) return null;

    const detail = m.detailGuide;

    const motionIcon = ICONS[`motion_${learnView}`] || ICONS.practice;

    return (
      <div className="main-content main-content-detail">
        <div className="content-view">
          {/* Header */}
          <header className="content-header">
            <button className="content-back" onClick={() => setLearnView(null)} aria-label="뒤로">
              <FontAwesomeIcon icon={ICONS.back} />
            </button>
            <div className="content-header-icon">
              <FontAwesomeIcon icon={motionIcon} />
            </div>
            <div className="content-header-text">
              <div className="content-header-eyebrow">동작</div>
              <h1 className="content-header-title">{m.name}</h1>
            </div>
          </header>

          <div className="content-body">
            <MascotBubble mood="happy">
              {`이 자세는 ${m.sub || m.name}(이)라고 해. 같이 배워보자!`}
            </MascotBubble>

            {/* 동작 이미지 */}
            {m.learnImage && (
              <div className="content-image-card">
                <img src={m.learnImage} alt={m.name} />
              </div>
            )}

            {/* 목적 */}
            <section className="content-section">
              <h2 className="content-section-heading">왜 이 동작을 배우나요?</h2>
              <p className="content-section-body">{detail?.purpose || m.guide}</p>
            </section>

            {/* 단계별 가이드 */}
            {detail?.stepByStep && (
              <section className="content-section">
                <h2 className="content-section-heading">단계별 자세</h2>
                <div className="steps-list">
                  {detail.stepByStep.map((item, i) => (
                    <div key={i} className="step-row">
                      <div className="step-row-track">
                        <div className="step-row-num">{i + 1}</div>
                        {i < detail.stepByStep.length - 1 && <div className="step-row-line" />}
                      </div>
                      <div className="step-row-body">
                        <div className="step-row-title">{item.step}</div>
                        <div className="step-row-desc">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 정보 chips */}
            <div className="motion-chips">
              <span className="motion-chip">
                <FontAwesomeIcon icon={m.posture === "standing" ? ICONS.practice : ICONS.target} />
                {m.posture === "standing" ? "서서" : "앉아서"}
              </span>
              <span className="motion-chip">
                <FontAwesomeIcon icon={m.holdMode ? ICONS.star : ICONS.play} />
                {m.holdMode ? `${m.holdGoal}초 유지` : `${m.targetCycles}회 반복`}
              </span>
            </div>

            {/* 핵심 포인트 */}
            {detail?.keyPoints && (
              <div className="key-points-card">
                <div className="key-points-head">
                  <FontAwesomeIcon icon={ICONS.star} />
                  <span>핵심 체크포인트</span>
                </div>
                <ul>
                  {detail.keyPoints.map((point, i) => (
                    <li key={i}>
                      <FontAwesomeIcon icon={ICONS.check} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 흔한 실수 */}
            {detail?.commonMistakes && (
              <div className="mistakes-card">
                <div className="mistakes-head">
                  <FontAwesomeIcon icon={ICONS.warn} />
                  <span>이런 실수 피하기</span>
                </div>
                <ul>
                  {detail.commonMistakes.map((mistake, i) => (
                    <li key={i}>
                      <FontAwesomeIcon icon={ICONS.close} />
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <button
            className="content-practice-btn"
            onClick={() => {
              const motionId = learnView;
              const mot = MOTIONS[motionId];
              const clf = classifiersRef.current[motionId];
              const trained = (clf?.numClasses || 0) >= 2;
              markLearnDone(`motion-${motionId}`);
              setLearnView(null);
              setActiveTab("practice");
              setHoldGoalInput(mot.holdGoal || 30);
              setCycleGoalInput(mot.targetCycles || 5);
              startPractice(motionId, trained ? "knn" : "instant");
            }}
          >
            <FontAwesomeIcon icon={ICONS.play} />
            <span>연습하러 가기</span>
          </button>

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

    // 기본 - 동작 선택
    return (
      <div className="main-content">
        <div className="practice-hero">
          <div className="practice-hero-eyebrow">
            <FontAwesomeIcon icon={ICONS.practice} />
            <span>PRACTICE</span>
          </div>
          <h1 className="practice-hero-title">동작 연습</h1>
          <p className="practice-hero-sub">카메라 앞에서 자세를 취하면 AI가 자동으로 채점해요</p>
        </div>

        <div className="motion-grid">
          {Object.entries(MOTIONS).filter(([, m]) => !m.hidden).map(([id, m]) => {
            const clf = classifiersRef.current[id];
            const trained = (clf?.numClasses || 0) >= 2;
            const mode = trained ? "knn" : "instant";
            const icon = ICONS[`motion_${id}`] || ICONS.practice;

            return (
              <button
                key={id}
                className="motion-card"
                onClick={() => {
                  setHoldGoalInput(m.holdGoal || 30);
                  setCycleGoalInput(m.targetCycles || 5);
                  startPractice(parseInt(id), mode);
                }}
              >
                <div className="motion-card-icon">
                  <FontAwesomeIcon icon={icon} />
                </div>
                <div className="motion-card-body">
                  <div className="motion-card-title">{m.name}</div>
                  <div className="motion-card-desc">{m.desc}</div>
                </div>
                <div className={`motion-card-badge ${trained ? "badge-ai" : "badge-instant"}`}>
                  {trained ? "AI" : "즉시"}
                </div>
                <div className="motion-card-arrow">
                  <FontAwesomeIcon icon={ICONS.next} />
                </div>
              </button>
            );
          })}
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
        {/* 헤더 (항상 표시) — 강사가 언제든 뒤로가기 */}
        <div className="practice-header">
          <button
            className="back-btn back-btn-lg"
            onClick={exitPractice}
            aria-label="뒤로가기"
          >
            <FontAwesomeIcon icon={ICONS.back} />
            <span className="back-btn-label">뒤로</span>
          </button>
          <div className="practice-header-title">
            <FontAwesomeIcon icon={ICONS[`motion_${currentMotion}`] || ICONS.practice} className="ph-motion-icon" />
            <h2>{m.name}</h2>
          </div>
          {/* 카메라 빠른 전환 (드롭다운) */}
          <div className="ph-camera-picker">
            <FontAwesomeIcon icon={ICONS.camera} className="ph-camera-icon" />
            <select
              className="ph-camera-select"
              value={selectedCameraId}
              onChange={async (e) => {
                const newId = e.target.value;
                setSelectedCameraId(newId);
                localStorage.setItem("swim_camera_id", newId);
                // 실행 중이면 카메라 재시작
                if (cameraActive) {
                  await stopCamera();
                  await startCamera();
                }
                showToast("카메라 전환됨");
              }}
              aria-label="카메라 전환"
            >
              {cameras.length === 0 ? (
                <option value="">카메라 찾는 중...</option>
              ) : (
                cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `카메라 ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>
          <span className={`mode-badge ${isRecord ? "mode-record" : practiceMode === "knn" ? "mode-knn" : "mode-instant"}`}>
            {isRecord ? "녹화" : practiceMode === "knn" ? "AI" : "즉시"}
          </span>
        </div>

        {/* 워크스페이스 (와이드에선 카메라+패널 가로배치) */}
        <div className="practice-workspace">

        {/* 카메라 영역 */}
        <div
          className="camera-container"
          ref={cameraContainerRef}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            webkit-playsinline=""
            muted
            disablePictureInPicture
            style={{ WebkitMediaPlaybackRequiresUserAction: false }}
          />
          <canvas ref={canvasRef} />

          {/* FPS */}
          {cameraActive && <div className="fps-badge">FPS: {fps}</div>}

          {/* 시작 대기 카드 */}
          {countdown === -1 && (
            <div className="start-wait-card">
              <p className="countdown-hint">카메라 위치를 확인하세요</p>

              {/* 유지시간 설정 */}
              {m.holdMode && (
                <div className="wait-goal-row">
                  <button className="goal-adj-btn" onClick={() => setHoldGoalInput(v => Math.max(5, v - 5))}>−</button>
                  <span className="wait-goal-value">{holdGoalInput}초</span>
                  <button className="goal-adj-btn" onClick={() => setHoldGoalInput(v => Math.min(60, v + 5))}>+</button>
                </div>
              )}

              {/* 횟수 설정 */}
              {m.guidedCycles && (
                <div className="wait-goal-row">
                  <button className="goal-adj-btn" onClick={() => setCycleGoalInput(v => Math.max(1, v - 1))}>−</button>
                  <span className="wait-goal-value">{cycleGoalInput}회</span>
                  <button className="goal-adj-btn" onClick={() => setCycleGoalInput(v => Math.min(20, v + 1))}>+</button>
                </div>
              )}

              <div className="wait-actions">
                {m.learnImage && (
                  <button
                    className="wait-preview-btn"
                    onClick={() => setPreviewImage(m.learnImage)}
                  >
                    <FontAwesomeIcon icon={ICONS.question} /> 자세 미리보기
                  </button>
                )}
                <button className="start-btn" onClick={beginCountdown}>시작</button>
              </div>
            </div>
          )}
          {countdown > 0 && (
            <div className="countdown-overlay">
              <span className="countdown-number">{countdown}</span>
            </div>
          )}

          {/* 자세 미리보기 버튼 */}
          {m.learnImage && !practiceComplete && (
            <button
              className="camera-preview-btn"
              onClick={() => setPreviewImage(m.learnImage)}
            >
              자세 미리보기
            </button>
          )}

          {/* 카메라 조정 경고 */}
          {cameraActive && countdown === 0 && feedback?.cameraWarning && (
            <div className="camera-warning">{feedback.cameraWarning}</div>
          )}

          {/* 순차 확인 사이클 가이드 (스컬링 등) */}
          {!isRecord && m.guidedCycles && session && !session.done && countdown === 0 && (
            <div className={`guided-cycle-overlay${session.guidedPhaseConfirmSec > 0 ? " confirming" : ""}`}>
              <span className="guided-cycle-phase">
                {currentMotion === 4
                  ? (session.currentGuidedPhase === "벌리기" ? "팔을 벌리세요 ↔" : "↔ 팔을 모으세요")
                  : currentMotion === 3
                  ? (session.currentGuidedPhase === "팔올리기" ? "팔을 올리세요 ☝"
                    : session.currentGuidedPhase === "흔들기좌" ? "← 왼쪽으로 흔드세요"
                    : "오른쪽으로 흔드세요 →")
                  : currentMotion === 5
                  ? (session.currentGuidedPhase === "오른뻗기" ? "오른팔 뻗기 ↑"
                    : session.currentGuidedPhase === "오른당기기" ? "오른팔 당기기 ↓"
                    : session.currentGuidedPhase === "왼뻗기" ? "왼팔 뻗기 ↑"
                    : "왼팔 당기기 ↓")
                  : session.currentGuidedPhase}
              </span>
              <span className="guided-cycle-count">{session.cyclesDone} / {m.targetCycles}회</span>
              <div className="guided-cycle-progress">
                <div className="guided-cycle-bar" style={{ width: `${Math.min(session.guidedPhaseConfirmSec / (m.guidedConfirmSec || 0.5) * 100, 100)}%` }} />
              </div>
            </div>
          )}

          {/* 가이드 단계 스켈레톤 오버레이 */}
          {!isRecord && m.holdStages && session && !session.guideStageDone && (
            <div className="skeleton-guide-overlay">
              <StageSkeleton
                motionId={parseInt(session.mid)}
                stageIndex={session.guideStageIdx}
                color="rgba(255,255,255,0.45)"
                highlightColor="#fff"
                size={160}
              />
              <span className="skeleton-guide-label">{session.currentGuideStage?.checkName}</span>
            </div>
          )}

          {/* 단계별 확인 타이머 오버레이 (가이드 진행 중) */}
          {!isRecord && m.holdStages && session && !session.guideStageDone && session.guideStageConfirmSec > 0 && (
            <div className="stage-confirm-overlay">
              <div className="stage-confirm-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" stroke="var(--border)" />
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    stroke="var(--success)"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={
                      2 * Math.PI * 46 * (1 - Math.min(
                        session.guideStageConfirmSec / session.currentGuideStage.confirmSec,
                        1
                      ))
                    }
                  />
                </svg>
                <span className="stage-confirm-text">{session.guideStageConfirmSec.toFixed(1)}</span>
              </div>
              <span className="stage-confirm-label">{session.currentGuideStage?.checkName}</span>
            </div>
          )}

          {/* 유지시간 타이머 (최종 유지 단계) */}
          {!isRecord && (m.holdMode || m.instantGoal) && session && session.holdSec > 0
            && (!m.holdStages || session.guideStageDone) && (
            <div className="hold-timer">
              <div className="hold-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" stroke="var(--border)" />
                  <circle
                    cx="50"
                    cy="50"
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

          {/* 완료 오버레이 */}
          {practiceComplete && (
            <div className="complete-overlay">
              <div className="complete-icon">{practiceComplete.motionIcon}</div>
              <div className="complete-title">목표 달성!</div>
              <div className="complete-motion">{practiceComplete.motionName}</div>
              <div className="complete-stats">
                {practiceComplete.holdMode ? (
                  <div className="complete-stat">
                    <span className="stat-value">{practiceComplete.holdSec.toFixed(1)}</span>
                    <span className="stat-label">초 유지</span>
                  </div>
                ) : practiceComplete.instantGoal ? (
                  <div className="complete-stat">
                    <span className="stat-value">{practiceComplete.holdSec.toFixed(1)}</span>
                    <span className="stat-label">초 연습</span>
                  </div>
                ) : (
                  <div className="complete-stat">
                    <span className="stat-value">{practiceComplete.cycles}</span>
                    <span className="stat-label">회 완료</span>
                  </div>
                )}
                <div className="complete-stat">
                  <span className="stat-value">{practiceComplete.score}</span>
                  <span className="stat-label">점</span>
                </div>
              </div>
              <div className="complete-buttons">
                <button className="complete-btn retry" onClick={() => {
                  setPracticeComplete(null);
                  session?.reset();
                  graceStartRef.current = null;
                  feedbackHistoryRef.current.clear();
                  feedbackRef.current = null;
                  setFeedback(null);
                  // RAF 재시작
                  if (!rafRef.current) {
                    rafRef.current = requestAnimationFrame(mainLoop);
                  }
                  forceUpdate(n => n + 1);
                }}>
                  다시 하기
                </button>
                <button className="complete-btn exit" onClick={exitPractice}>
                  다른 동작
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 녹화 패널 */}
        {isRecord && renderRecordPanel()}

        {/* 피드백 패널 */}
        {!isRecord && !practiceComplete && renderFeedbackPanel()}

        {/* 컨트롤 (녹화 모드만) */}
        {!practiceComplete && isRecord && (
          <div className="practice-controls">
            <button className="ctrl-btn primary" onClick={recordSample}>
              <FontAwesomeIcon icon={ICONS.camera} /> 녹화 (SPACE)
            </button>
            <button className="ctrl-btn secondary" onClick={canManageTrainingData ? saveRecordedSamples : exitPractice}>
              {canManageTrainingData ? "저장" : "완료"}
            </button>
          </div>
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
              <div key={step} className="step-btn-wrap">
                <button
                  className={`step-btn ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedStep(i)}
                >
                  <div className={`step-icon ${iconClass}`}>
                    {isActive ? "●" : cnt >= 10 ? "✓" : cnt || "·"}
                  </div>
                  <span className="step-name">{step}</span>
                  <span className="step-count">{cnt}개</span>
                </button>
                {cnt > 0 && (
                  <button
                    className="step-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteLabel(step); }}
                    title={`${step} 데이터 삭제`}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
        <p className="record-info">
          자세를 취하고 <b style={{ color: "var(--accent)" }}>녹화</b> 버튼을 눌러 저장하세요.
          단계별 10~15개 권장.
        </p>
        {canManageTrainingData ? (
          <p className="record-info" style={{ color: "var(--success)", marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FontAwesomeIcon icon={ICONS.adminLogin} /> 관리자 모드: 서버에 저장됩니다
          </p>
        ) : (
          <p className="record-info" style={{ color: "var(--text2)", marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FontAwesomeIcon icon={ICONS.info} /> 로컬 저장 (이 기기에서만 사용)
          </p>
        )}
      </div>
    );
  }

  // 피드백 패널
  function renderFeedbackPanel() {
    const fb = feedback || feedbackRef.current;
    if (!fb) return (
      <div className="feedback-panel">
        <div className="feedback-score">
          <div className="score-circle">
            <svg viewBox="0 0 56 56">
              <circle cx="28" cy="28" r={24} stroke="var(--border)" />
            </svg>
            0%
          </div>
          <div className="feedback-message">
            <div className="main-msg">카메라에 자세를 보여주세요</div>
            <div className="sub-msg">포즈 감지 대기 중...</div>
          </div>
        </div>
      </div>
    );

    const { checks, overallScore, summaryMessage, allPassed } = fb;
    const session = sessionRef.current;
    const isGuidedHold = session?.motion?.holdStages && !session?.guideStageDone;
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - overallScore / 100);

    return (
      <div className="feedback-panel">
        <div className="feedback-score">
          <div className={`score-circle ${allPassed ? "perfect" : ""}`}>
            <svg viewBox="0 0 56 56">
              <circle cx="28" cy="28" r={radius} stroke="var(--border)" />
              <circle
                cx="28"
                cy="28"
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
              {isGuidedHold ? session.currentGuideStage?.label : summaryMessage}
            </div>
            <div className="sub-msg">
              {isGuidedHold
                ? `단계 ${session.guideStageIdx + 1} / ${session.guideStageCount}`
                : allPassed ? "자세를 유지하세요!" : "아래 체크포인트를 확인하세요"}
            </div>
          </div>
        </div>

        {/* 가이드 단계 진행 바 */}
        {session?.motion?.holdStages && (
          <div className="stage-progress">
            <div className="stage-progress-bar">
              {session.motion.holdStages.map((_, i) => (
                <div
                  key={i}
                  className={`stage-dot ${
                    i < session.guideStageIdx ? "completed" :
                    i === session.guideStageIdx && !session.guideStageDone ? "active" :
                    session.guideStageDone ? "completed" : "pending"
                  }`}
                />
              ))}
              <div className={`stage-dot ${session.guideStageDone ? "active" : "pending"}`} />
            </div>
            {/* 단계 확인 progress bar */}
            {isGuidedHold && session.guideStageConfirmSec > 0 && (
              <div className="stage-confirm-bar">
                <div
                  className="stage-confirm-fill"
                  style={{
                    width: `${Math.min(
                      (session.guideStageConfirmSec / session.currentGuideStage.confirmSec) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* 전체 단계 완료 배너 */}
        {session?.guideStageDone && session.motion.holdStages && (
          <div className="stage-complete-banner">
            자세 완성! {session.customHoldGoal}초 유지하세요
          </div>
        )}

        <div className="feedback-checks">
          {checks.map((check, i) => {
            const isLocked = isGuidedHold && i > session.guideStageIdx;
            const isCurrentStage = isGuidedHold && i === session.guideStageIdx;

            return (
              <div key={i} className={`check-item ${
                isLocked ? "locked" : check.passed ? "passed" : "failed"
              } ${isCurrentStage ? "current-stage" : ""}`}>
                <span className={`check-icon ${session?.motion?.holdStages ? "has-skeleton" : ""}`}>
                  {session?.motion?.holdStages ? (
                    <StageSkeleton
                      motionId={parseInt(session.mid)}
                      stageIndex={i}
                      color={
                        isLocked ? "var(--text3)" :
                        check.passed ? "var(--success)" :
                        isCurrentStage ? "var(--accent)" :
                        "var(--warning)"
                      }
                      highlightColor={
                        isLocked ? "var(--text3)" :
                        isCurrentStage ? "#fff" :
                        undefined
                      }
                      size={36}
                    />
                  ) : (
                    <FontAwesomeIcon icon={
                      isLocked ? ICONS.lock
                        : check.passed ? ICONS.check
                        : isCurrentStage ? ICONS.play
                        : ICONS.warn
                    } />
                  )}
                </span>
                <div className="check-text">
                  <div className="check-name">{check.name}</div>
                  <div className="check-msg">
                    {isLocked ? "이전 단계를 완료하세요" : check.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 기록 탭
  // localStorage 데이터 병합 (Supabase 데이터가 없는 동작만)
  function mergeLocalStorage() {
    for (let i = 1; i <= 6; i++) {
      const clf = classifiersRef.current[i];
      // Supabase에서 이미 로드된 데이터가 있으면 건너뛰기 (중복 방지)
      if (clf.totalSamples > 0) continue;

      const saved = localStorage.getItem(`swim_knn_${i}`);
      if (saved) {
        try {
          const localSamples = JSON.parse(saved);
          const m = MOTIONS[i];
          // 옛 라벨→현재 라벨 매핑 (이름 변경 대응)
          const labelMap = { "밀기": "벌리기", "당기기": "모으기" };
          const validSteps = new Set(m.steps);
          for (const [label, features] of Object.entries(localSamples)) {
            const mapped = labelMap[label] || label;
            // 현재 steps에 있는 라벨만 로드
            if (validSteps.has(mapped)) {
              for (const feat of features) {
                clf.addSample(mapped, feat);
              }
            }
          }
        } catch (e) {
          console.error(`Failed to merge local data for motion ${i}:`, e);
        }
      }
    }
  }

  // 학교 관리자 로그인
  async function handleAdminLogin(schoolId, password) {
    try {
      const valid = await verifyAdminPassword(schoolId, password);
      if (valid) {
        setIsAdmin(true);
        setSelectedSchoolId(schoolId);
        localStorage.setItem("swim_school_id", schoolId);
        showToast("관리자 로그인 성공");

        // 해당 학교 데이터 다시 로드
        setDataLoading(true);
        for (let i = 1; i <= 6; i++) {
          await classifiersRef.current[i].loadFromSupabase(
            i.toString(), MOTIONS[i].steps, schoolId
          );
        }
        mergeLocalStorage();
        setDataLoading(false);
        forceUpdate(n => n + 1);
      } else {
        showToast("비밀번호가 틀립니다", "error");
      }
    } catch (err) {
      console.error("Admin login failed:", err);
      showToast("로그인 실패", "error");
    }
  }

  // 학교 생성
  async function handleCreateSchool(name, password) {
    try {
      const newSchool = await createSchool(name, password);
      setSchools(prev => [...prev, newSchool]);
      showToast(`'${name}' 학교가 생성되었습니다`);
      return newSchool;
    } catch (err) {
      console.error("Create school failed:", err);
      if (err.message?.includes("duplicate")) {
        showToast("이미 존재하는 학교명입니다", "error");
      } else {
        showToast("학교 생성 실패", "error");
      }
      return null;
    }
  }

  // localStorage → Supabase 업로드
  // motionId: 특정 동작만 업로드 (null이면 전체)
  // overwrite: true면 덮어쓰기, false면 추가
  async function handleUploadToSupabase(motionId = null, overwrite = false) {
    const schoolId = selectedSchoolId || DEFAULT_SCHOOL_ID;
    let totalUploaded = 0;
    const motionIds = motionId ? [motionId] : [1, 2, 3, 4, 5, 6];

    // 총 업로드할 샘플 수 미리 계산
    let totalToUpload = 0;
    for (const mid of motionIds) {
      const saved = localStorage.getItem(`swim_knn_${mid}`);
      if (!saved) continue;
      const localSamples = JSON.parse(saved);
      const m = MOTIONS[mid];
      for (const [label, features] of Object.entries(localSamples)) {
        if (m.steps.indexOf(label) !== -1) totalToUpload += features.length;
      }
    }

    if (totalToUpload === 0) {
      await showModal({ title: "업로드 실패", message: "업로드할 로컬 데이터가 없습니다." });
      return;
    }

    setLoadingMsg(`업로드 준비 중... 0/${totalToUpload}`);
    setDataLoading(true);

    try {
      if (overwrite) {
        setLoadingMsg("기존 데이터 삭제 중...");
        if (motionId) {
          await deleteTrainingData(motionId.toString(), schoolId);
        } else {
          await deleteAllTrainingDataBySchool(schoolId);
        }
      }

      for (const mid of motionIds) {
        const saved = localStorage.getItem(`swim_knn_${mid}`);
        if (!saved) continue;

        const localSamples = JSON.parse(saved);
        const m = MOTIONS[mid];

        for (const [label, features] of Object.entries(localSamples)) {
          const stepIndex = m.steps.indexOf(label);
          if (stepIndex === -1) continue;

          for (const feat of features) {
            await saveTrainingData(mid.toString(), stepIndex, feat, schoolId);
            totalUploaded++;
            if (totalUploaded % 5 === 0 || totalUploaded === totalToUpload) {
              setLoadingMsg(`업로드 중... ${totalUploaded}/${totalToUpload}`);
            }
          }
        }
      }
      // 업로드 성공 후 localStorage 정리 (중복 로딩 방지)
      for (const mid of motionIds) {
        localStorage.removeItem(`swim_knn_${mid}`);
      }

      // Supabase에서 다시 로드하여 라벨 동기화
      for (let i = 1; i <= 6; i++) {
        await classifiersRef.current[i].loadFromSupabase(
          i.toString(), MOTIONS[i].steps, schoolId || null
        );
      }

      setDataLoading(false);
      setLoadingMsg("");
      forceUpdate(n => n + 1);
      await showModal({ title: "업로드 완료", message: `${totalUploaded}개 샘플이 서버에 업로드되었습니다.\n로컬 임시 데이터는 정리되었습니다.` });
    } catch (err) {
      console.error("Upload failed:", err);
      setDataLoading(false);
      setLoadingMsg("");
      await showModal({ title: "업로드 오류", message: `업로드 중 오류가 발생했습니다.\n(${totalUploaded}/${totalToUpload}개 완료)` });
    }
  }

  // 학교 선택 (누구든 선택 가능 — 데이터 조회는 권한 무관)
  // preserveAdmin=true 이면 학교 관리자 상태 유지
  async function handleSchoolSelect(schoolId, opts = {}) {
    if (!opts.preserveAdmin) setIsAdmin(false);
    setSelectedSchoolId(schoolId);
    localStorage.setItem("swim_school_id", schoolId);

    // 로딩 오버레이 표시 (dataLoading + loadingMsg 둘 다 필요)
    const targetName = schoolId && schoolId !== DEFAULT_SCHOOL_ID
      ? (schools.find(s => s.id === schoolId)?.name || "학교")
      : "기본 (root)";
    setLoadingMsg(`${targetName} 데이터 불러오는 중...`);
    setDataLoading(true);

    // 해당 학교 데이터 로드 (학교간 완전 격리, 6개 동작)
    let totalLoaded = 0;
    for (let i = 1; i <= 6; i++) {
      setLoadingMsg(`${targetName} 데이터 불러오는 중... (${i}/6)`);
      await classifiersRef.current[i].loadFromSupabase(
        i.toString(), MOTIONS[i].steps, schoolId || null
      );
      totalLoaded += classifiersRef.current[i].totalSamples;
    }

    // localStorage merge는 default(root) 컨텍스트에서만 — 학교간 오염 방지
    const isDefaultContext = !schoolId || schoolId === DEFAULT_SCHOOL_ID;
    if (isDefaultContext) mergeLocalStorage();

    setDataLoading(false);
    setLoadingMsg("");
    forceUpdate(n => n + 1);

    const label = isDefaultContext ? "기본 데이터" : "학교 데이터";
    if (totalLoaded === 0) {
      showToast(`${label} 로드 완료 — 저장된 샘플 없음`, "error");
    } else {
      showToast(`${label} 로드 완료 — 총 ${totalLoaded}개 샘플`);
    }
  }

  // 학교 컨텍스트 전환 (root/sub 전용 — 학교 계정 관리 리스트에서 호출)
  async function switchSchoolContext(schoolId, name) {
    if (!isSystemAdmin) return;
    await handleSchoolSelect(schoolId);
    showToast(`컨텍스트: ${name}`);
  }

  // 설정 탭
  function renderSettingsTab() {
    return (
      <div className="main-content">
        <div className="practice-hero">
          <div className="practice-hero-eyebrow">
            <FontAwesomeIcon icon={ICONS.settings} />
            <span>SETTINGS</span>
          </div>
          <h1 className="practice-hero-title">설정</h1>
          <p className="practice-hero-sub">앱 설정 및 데이터 관리</p>
        </div>

        {/* 서브탭 바 — 기기 설정은 로그인 없이도 접근 가능 */}
        {(() => {
          const tabs = [
            { key: "account", label: "내 계정", icon: ICONS.adminLogin, show: hasAdminPower },
            { key: "schools", label: "학교 관리", icon: ICONS.school, show: isSystemAdmin },
            { key: "data", label: "데이터 관리", icon: ICONS.record, show: canManageTrainingData },
            { key: "device", label: "기기 설정", icon: ICONS.camera, show: true },
          ].filter(t => t.show);
          const currentValid = tabs.some(t => t.key === settingsTab);
          if (!currentValid && tabs.length > 0) {
            setTimeout(() => setSettingsTab(tabs[0].key), 0);
          }
          return (
            <div className="settings-subtabs" role="tablist">
              {tabs.map(t => (
                <button
                  key={t.key}
                  role="tab"
                  className={`settings-subtab ${settingsTab === t.key ? "active" : ""}`}
                  onClick={() => setSettingsTab(t.key)}
                >
                  <FontAwesomeIcon icon={t.icon} />
                  <span>{t.label}</span>
                </button>
              ))}
              {!hasAdminPower && (
                <button
                  className="settings-subtab settings-subtab-login"
                  onClick={() => {
                    setLoginModal("open");
                    setLoginUsername("");
                    setLoginPassword("");
                    setLoginError("");
                  }}
                  title="관리자 로그인"
                >
                  <FontAwesomeIcon icon={ICONS.adminLogin} />
                  <span>로그인</span>
                </button>
              )}
            </div>
          );
        })()}

        {/* 로그아웃 상태 + 로그인 필요한 탭 선택시 — 로그인 안내 카드 */}
        {!hasAdminPower && settingsTab !== "device" && (
          <div className="settings-section login-required-card">
            <div className="login-required-icon">
              <FontAwesomeIcon icon={ICONS.lock} />
            </div>
            <h3>로그인이 필요합니다</h3>
            <p className="login-required-desc">
              이 섹션은 관리자 로그인이 필요합니다.
              연습·학습 탭과 기기 설정은 로그인 없이도 사용 가능합니다.
            </p>
            <div className="login-actions">
              <button
                className="setting-btn primary"
                onClick={() => {
                  setLoginModal("open");
                  setLoginUsername("");
                  setLoginPassword("");
                  setLoginError("");
                }}
              >
                <FontAwesomeIcon icon={ICONS.adminLogin} /> 관리자 로그인
              </button>
            </div>
          </div>
        )}

        {/* 학교 설정 → 내 계정 탭 */}
        {hasAdminPower && settingsTab === "account" && (
        <div className="settings-section">
          <h3>내 계정 · 현재 컨텍스트</h3>

          {/* 현재 컨텍스트 */}
          <div className="setting-item">
            <span className="setting-icon"><FontAwesomeIcon icon={ICONS.school} /></span>
            <div className="setting-text">
              <h4>현재 학교 컨텍스트</h4>
              <p>
                {selectedSchoolId && selectedSchoolId !== DEFAULT_SCHOOL_ID
                  ? schools.find(s => s.id === selectedSchoolId)?.name || "알 수 없음"
                  : "기본 (root 데이터)"}
                {isAdmin && " · 학교 관리자"}
              </p>
            </div>
          </div>

          {/* 컨텍스트 전환 (root/sub 전용 — 학교 관리자는 자기 학교 고정) */}
          {isSystemAdmin && (
            <label className="pretty-select">
              <span className="pretty-select-label">
                <FontAwesomeIcon icon={ICONS.refresh} /> 컨텍스트 전환
              </span>
              <select
                value={selectedSchoolId || DEFAULT_SCHOOL_ID}
                onChange={(e) => handleSchoolSelect(e.target.value)}
                className="pretty-select-input"
                disabled={dataLoading}
              >
                <option value={DEFAULT_SCHOOL_ID}>기본 (root 데이터)</option>
                {schools.filter(s => s.id !== DEFAULT_SCHOOL_ID).map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 현재 로드된 학습 데이터 요약 (모두 볼 수 있음) */}
          {!dataLoading && (
            <div className="data-summary-card">
              <div className="data-summary-head">
                <FontAwesomeIcon icon={ICONS.info} />
                <span>현재 로드된 학습 데이터</span>
                <span className="data-summary-total">
                  {Object.values(classifiersRef.current).reduce((s, c) => s + (c?.totalSamples || 0), 0)}개
                </span>
              </div>
              <div className="data-summary-grid">
                {Object.entries(MOTIONS).filter(([, m]) => !m.hidden).map(([id, m]) => {
                  const clf = classifiersRef.current[id];
                  const total = clf?.totalSamples || 0;
                  const trained = (clf?.numClasses || 0) >= 2;
                  return (
                    <div key={id} className={`data-summary-item ${trained ? "ready" : ""}`}>
                      <FontAwesomeIcon icon={ICONS[`motion_${id}`] || ICONS.practice} />
                      <span className="data-summary-name">{m.name}</span>
                      <span className="data-summary-count">{total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 로그인 상태 뱃지 */}
          {isSystemAdmin && (
            <div className="admin-status-card">
              <div className="admin-status-role">
                <FontAwesomeIcon icon={isRoot ? ICONS.trophy : ICONS.adminLogin} />
                <span>{isRoot ? "최고 관리자 (Root)" : "서브 관리자"}</span>
              </div>
              <div className="admin-status-name">{currentAdmin.username}</div>
              <button
                className="setting-btn small"
                onClick={handleSystemLogout}
              >
                <FontAwesomeIcon icon={ICONS.adminLogout} /> 로그아웃
              </button>
            </div>
          )}

          {/* 학교 관리자 로그아웃 (레거시) */}
          {isAdmin && !isSystemAdmin && (
            <button
              className="setting-btn"
              style={{ marginTop: "12px" }}
              onClick={() => {
                setIsAdmin(false);
                setShowAdminLogin(false);
                showToast("학교 관리자 로그아웃");
              }}
            >
              <FontAwesomeIcon icon={ICONS.adminLogout} /> 관리자 로그아웃
            </button>
          )}
        </div>
        )}

        {/* ═══ 관리자 관리 (root 전용, 내 계정 탭) ═══ */}
        {isRoot && settingsTab === "account" && (
          <div className="settings-section">
            <h3>
              <FontAwesomeIcon icon={ICONS.trophy} /> 관리자 관리
              <span className="root-only-badge">ROOT 전용</span>
            </h3>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
              서브 관리자를 만들고 조회합니다. 서브 관리자는 관리자 관리를 제외한 모든 권한을 갖습니다.
            </p>

            {/* 서브 관리자 추가 폼 */}
            <div className="admin-create-form">
              <input
                type="text"
                className="admin-form-input"
                placeholder="아이디 (3자 이상)"
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                autoComplete="off"
              />
              <input
                type="text"
                className="admin-form-input"
                placeholder="비밀번호 (6자 이상)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                className="setting-btn primary"
                disabled={!newAdminUsername || !newAdminPassword}
                onClick={handleCreateSubAdmin}
              >
                <FontAwesomeIcon icon={ICONS.add} /> 서브 관리자 추가
              </button>
            </div>

            {/* 관리자 목록 열람 */}
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="setting-btn"
                onClick={async () => {
                  if (!showAdminList) await loadAdminList();
                  setShowAdminList(v => !v);
                }}
              >
                <FontAwesomeIcon icon={showAdminList ? ICONS.close : ICONS.info} />
                {showAdminList ? " 목록 닫기" : " 관리자 목록 보기"}
              </button>
              {showAdminList && (
                <button
                  className="setting-btn"
                  onClick={() => setShowAdminPasswords(v => !v)}
                >
                  <FontAwesomeIcon icon={showAdminPasswords ? ICONS.lock : ICONS.unlock} />
                  {showAdminPasswords ? " 비밀번호 숨기기" : " 비밀번호 보기"}
                </button>
              )}
            </div>

            {showAdminList && (
              <div className="admin-list">
                {adminList.length === 0 ? (
                  <p className="admin-list-empty">등록된 관리자가 없습니다.</p>
                ) : (
                  adminList.map(a => (
                    <div key={a.id} className={`admin-list-row role-${a.role}`}>
                      <div className="admin-list-role">
                        <FontAwesomeIcon icon={a.role === "root" ? ICONS.trophy : ICONS.adminLogin} />
                        <span>{a.role.toUpperCase()}</span>
                      </div>
                      <div className="admin-list-info">
                        <div className="admin-list-username">{a.username}</div>
                        <div className="admin-list-password">
                          {showAdminPasswords
                            ? <span className="pw-visible">{a.password}</span>
                            : <span className="pw-masked">••••••••</span>
                          }
                        </div>
                        <div className="admin-list-date">
                          {new Date(a.created_at).toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                      {a.role !== "root" && (
                        <button
                          className="admin-list-delete"
                          onClick={() => handleDeleteAdmin(a.id, a.username)}
                          title="이 관리자 삭제"
                          aria-label="삭제"
                        >
                          <FontAwesomeIcon icon={ICONS.trash} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {showAdminPasswords && (
              <p className="admin-warn-note">
                <FontAwesomeIcon icon={ICONS.warn} /> 비밀번호가 화면에 노출됩니다. 주변에 사람이 있는지 확인하세요.
              </p>
            )}
          </div>
        )}

        {/* ═══ 학교 관리 탭 (root + sub-admin) ═══ */}
        {isSystemAdmin && settingsTab === "schools" && (
          <div className="settings-section">
            <h3>
              <FontAwesomeIcon icon={ICONS.school} /> 학교 관리
            </h3>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
              학교 계정을 만들고 관리합니다. 컨텍스트 전환은 <b style={{ color: "var(--accent)" }}>내 계정</b> 탭에서.
            </p>

            {/* 새 학교 등록 */}
            <button
              className="setting-btn primary"
              onClick={async () => {
                const result = await showModal({ type: "prompt2", title: "새 학교 등록", message: "학교 이름과 관리자 비밀번호를 입력하세요.", placeholder: "학교 이름", placeholder2: "관리자 비밀번호" });
                if (result) handleCreateSchool(result.val1, result.val2);
              }}
            >
              <FontAwesomeIcon icon={ICONS.add} /> 새 학교 등록
            </button>

            <div style={{ height: 16 }} />

            <h3 style={{ fontSize: 13, color: "var(--text-3)", marginTop: 16, marginBottom: 12 }}>
              학교 계정 목록
            </h3>

            {/* 목록 열람 / 비밀번호 토글 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="setting-btn"
                onClick={async () => {
                  if (!showSchoolList) await loadSchoolAdminList();
                  setShowSchoolList(v => !v);
                }}
              >
                <FontAwesomeIcon icon={showSchoolList ? ICONS.close : ICONS.info} />
                {showSchoolList ? " 목록 닫기" : " 학교 목록 보기"}
              </button>
              {showSchoolList && (
                <button
                  className="setting-btn"
                  onClick={() => setShowSchoolPasswords(v => !v)}
                >
                  <FontAwesomeIcon icon={showSchoolPasswords ? ICONS.lock : ICONS.unlock} />
                  {showSchoolPasswords ? " 비밀번호 숨기기" : " 비밀번호 보기"}
                </button>
              )}
            </div>

            {showSchoolList && (
              <div className="admin-list" style={{ marginTop: 16 }}>
                {schoolAdminList.length === 0 ? (
                  <p className="admin-list-empty">등록된 학교가 없습니다.</p>
                ) : (
                  schoolAdminList.map(s => {
                    const isDefault = s.id === DEFAULT_SCHOOL_ID;
                    const isCurrent = (selectedSchoolId || DEFAULT_SCHOOL_ID) === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`admin-list-row ${isDefault ? "role-root" : ""} ${isCurrent ? "current-context" : ""}`}
                      >
                        <div className="admin-list-role">
                          <FontAwesomeIcon icon={ICONS.school} />
                          <span>{isDefault ? "기본" : "학교"}</span>
                        </div>
                        <div className="admin-list-info">
                          <div className="admin-list-username">
                            {s.name}
                            {isCurrent && (
                              <span className="current-context-badge">현재 컨텍스트</span>
                            )}
                          </div>
                          <div className="admin-list-password">
                            {showSchoolPasswords
                              ? <span className="pw-visible">{s.admin_password}</span>
                              : <span className="pw-masked">••••••••</span>
                            }
                          </div>
                          <div className="admin-list-date">
                            {new Date(s.created_at).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="admin-list-delete"
                            style={{ background: "rgba(45,212,191,0.12)", color: "var(--success)", borderColor: "rgba(45,212,191,0.3)" }}
                            onClick={() => switchSchoolContext(s.id, s.name)}
                            disabled={isCurrent}
                            title={isCurrent ? "이미 이 학교 컨텍스트임" : `${s.name}의 학습 데이터로 전환`}
                            aria-label="이 학교로 전환"
                          >
                            <FontAwesomeIcon icon={ICONS.refresh} />
                          </button>
                          <button
                            className="admin-list-delete"
                            style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent)", borderColor: "rgba(0,212,255,0.3)" }}
                            onClick={() => handleUpdateSchoolPassword(s.id, s.name)}
                            title="비밀번호 변경"
                            aria-label="비밀번호 변경"
                          >
                            <FontAwesomeIcon icon={ICONS.adminLogin} />
                          </button>
                          {!isDefault && (
                            <button
                              className="admin-list-delete"
                              onClick={() => handleDeleteSchool(s.id, s.name)}
                              title="학교 삭제 (학습 데이터 포함 완전 삭제)"
                              aria-label="삭제"
                            >
                              <FontAwesomeIcon icon={ICONS.trash} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {showSchoolPasswords && (
              <p className="admin-warn-note">
                <FontAwesomeIcon icon={ICONS.warn} /> 비밀번호가 화면에 노출됩니다. 주변에 사람이 있는지 확인하세요.
              </p>
            )}
          </div>
        )}

        {/* 녹화 모드 → 데이터 관리 탭 */}
        {canManageTrainingData && settingsTab === "data" && (
          <div className="settings-section">
            <h3>
              <FontAwesomeIcon icon={ICONS.record} /> AI 학습 녹화
            </h3>
            <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>
              동작별 학습 데이터를 녹화합니다
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(MOTIONS).filter(([, m]) => !m.hidden).map(([id, m]) => (
                <button
                  key={id}
                  className="setting-btn"
                  onClick={() => {
                    setCurrentMotion(parseInt(id));
                    setSelectedStep(0);
                    setActiveTab("practice");
                    setPracticeMode("record");
                    startCamera();
                  }}
                >
                  <FontAwesomeIcon icon={ICONS[`motion_${id}`] || ICONS.record} /> {m.name} 녹화
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 카메라 설정 → 기기 설정 탭 */}
        {settingsTab === "device" && (
        <div className="settings-section">
          <h3>카메라 설정</h3>
          <div className="setting-item">
            <span className="setting-icon"><FontAwesomeIcon icon={ICONS.camera} /></span>
            <div className="setting-text">
              <h4>카메라 선택</h4>
              <p>사용할 카메라를 선택하세요</p>
            </div>
          </div>
          <label className="pretty-select">
            <span className="pretty-select-label">
              <FontAwesomeIcon icon={ICONS.camera} /> 사용할 카메라
            </span>
            <select
              value={selectedCameraId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCameraId(newId);
                localStorage.setItem("swim_camera_id", newId);
                showToast("카메라가 변경되었습니다");
              }}
              className="pretty-select-input"
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
          </label>
          <button
            className="setting-btn"
            style={{ marginTop: "12px" }}
            onClick={loadCameras}
          >
            <FontAwesomeIcon icon={ICONS.refresh} /> 카메라 목록 새로고침
          </button>

          <div style={{ height: 20 }} />
          <h3>화면 크기</h3>
          <div className="setting-item">
            <span className="setting-icon"><FontAwesomeIcon icon={ICONS.settings} /></span>
            <div className="setting-text">
              <h4>현재 배율: {Math.round(effectiveScale * 100)}%</h4>
              <p>{uiScale == null ? "자동 감지 모드" : "수동 설정됨"} · 화면 우상단 툴바에서 조정</p>
            </div>
          </div>
        </div>
        )}

        {/* 데이터 관리 (관리자 전용) */}
        {canManageTrainingData && settingsTab === "data" && (<div className="settings-section">
          <h3>학습 데이터</h3>
          {Object.entries(MOTIONS).map(([id, m]) => {
            const clf = classifiersRef.current[id];
            const counts = clf?.getSampleCounts() || {};
            const total = clf?.totalSamples || 0;

            return (
              <div key={id} className="data-motion">
                <div className="dm-header">
                  <span className="dm-icon"><FontAwesomeIcon icon={ICONS[`motion_${id}`] || ICONS.practice} /></span>
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
                    <FontAwesomeIcon icon={ICONS.exportFile} /> 내보내기
                  </button>
                  <button
                    disabled={dataLoading || total === 0}
                    onClick={async () => {
                      const ok = await showModal({ title: `${m.name} 업로드`, message: "서버에 추가합니다. (기존 데이터 유지)" });
                      if (ok) handleUploadToSupabase(parseInt(id), false);
                    }}
                  >
                    <FontAwesomeIcon icon={ICONS.upload} /> 추가
                  </button>
                  <button
                    disabled={dataLoading || total === 0}
                    onClick={async () => {
                      const ok = await showModal({ title: `${m.name} 덮어쓰기`, message: "서버의 기존 데이터를 삭제하고 새로 업로드합니다.", danger: true });
                      if (ok) handleUploadToSupabase(parseInt(id), true);
                    }}
                  >
                    <FontAwesomeIcon icon={ICONS.refresh} /> 덮어쓰기
                  </button>
                  <button
                    className="delete"
                    onClick={async () => {
                      const ok = await showModal({ title: "데이터 삭제", message: `${m.name}의 모든 학습 데이터를 삭제할까요?`, danger: true });
                      if (ok) {
                        clf?.clear();
                        localStorage.removeItem(`swim_knn_${id}`);
                        showToast("삭제 완료");
                        forceUpdate(n => n + 1);
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={ICONS.trash} /> 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>)}

        {canManageTrainingData && settingsTab === "data" && (<div className="settings-section">
          <h3>전체 데이터</h3>
          <button
            className="setting-btn primary"
            onClick={async () => {
              const ok = await showModal({ title: "전체 추가 업로드", message: "모든 로컬 학습 데이터를 서버에 추가합니다.\n기존 서버 데이터는 유지됩니다." });
              if (ok) handleUploadToSupabase(null, false);
            }}
            disabled={dataLoading}
          >
            {dataLoading
              ? <><FontAwesomeIcon icon={ICONS.hourglass} /> 업로드 중...</>
              : <><FontAwesomeIcon icon={ICONS.upload} /> 전체 추가 업로드</>}
          </button>
          <button
            className="setting-btn"
            onClick={async () => {
              const ok = await showModal({ title: "전체 덮어쓰기", message: "서버의 기존 데이터를 모두 삭제하고\n로컬 데이터로 새로 업로드합니다.", danger: true });
              if (ok) handleUploadToSupabase(null, true);
            }}
            disabled={dataLoading}
          >
            <FontAwesomeIcon icon={ICONS.refresh} /> 전체 덮어쓰기
          </button>
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
            <FontAwesomeIcon icon={ICONS.exportFile} /> 전체 내보내기
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
            <FontAwesomeIcon icon={ICONS.importFile} /> 가져오기
          </button>

          <button
            className="setting-btn danger"
            onClick={async () => {
              const ok = await showModal({ title: "전체 삭제", message: "모든 데이터(학습 데이터 + 연습 기록)를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.", danger: true });
              if (ok) {
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
            <FontAwesomeIcon icon={ICONS.trash} /> 전체 삭제
          </button>
        </div>)}

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
      {/* 화면 크기 조절 툴바 (강사용, 상시 노출) */}
      <div className="scale-toolbar" aria-label="화면 크기 조절">
        <button
          className="scale-btn"
          onClick={() => bumpScale(-0.1)}
          aria-label="글자 작게"
          title="글자 작게"
        >
          A−
        </button>
        <button
          className="scale-btn scale-btn-value"
          onClick={() => setUiScale(null)}
          aria-label="자동 크기로 되돌리기"
          title="자동 감지 모드로 전환 (오버라이드 해제)"
        >
          {uiScale == null && <span className="scale-auto-dot" aria-hidden="true" />}
          {Math.round(effectiveScale * 100)}%
        </button>
        <button
          className="scale-btn"
          onClick={() => bumpScale(0.1)}
          aria-label="글자 크게"
          title="글자 크게"
        >
          A+
        </button>
        <button
          className="scale-btn scale-btn-fit"
          onClick={fitToScreen}
          aria-label="이 모니터에 맞추기"
          title="이 모니터에 최적 크기로 맞추기 (뷰포트+DPR+터치 감지)"
        >
          ⤢
        </button>
      </div>

      {/* 셸: 사이드바(대형) 또는 하단 탭바(모바일) + 메인 */}
      <div className={`app-shell ${!showTabBar ? "app-shell-fullscreen" : ""}`}>
        {showTabBar && (
          <nav className="app-nav" aria-label="주 메뉴">
            <button
              className={`nav-item ${activeTab === "practice" ? "active" : ""}`}
              onClick={() => { setActiveTab("practice"); setPracticeMode(null); setCurrentMotion(null); }}
            >
              <FontAwesomeIcon icon={ICONS.practice} className="nav-icon" />
              <span className="nav-label">연습</span>
            </button>
            <button
              className={`nav-item ${activeTab === "learn" ? "active" : ""}`}
              onClick={() => { setActiveTab("learn"); setLearnView(null); }}
            >
              <FontAwesomeIcon icon={ICONS.learn} className="nav-icon" />
              <span className="nav-label">학습</span>
            </button>
            <button
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <FontAwesomeIcon icon={ICONS.settings} className="nav-icon" />
              <span className="nav-label">설정</span>
            </button>
          </nav>
        )}

        <main className="app-main">
          {activeTab === "practice" && renderPracticeTab()}
          {activeTab === "learn" && renderLearnTab()}
          {activeTab === "settings" && renderSettingsTab()}
        </main>
      </div>

      {/* 로딩 오버레이 */}
      {dataLoading && loadingMsg && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p className="loading-text">{loadingMsg}</p>
        </div>
      )}

      {/* 커스텀 모달 */}
      {modal && (
        <div className="modal-overlay" {...overlayDismissHandlers(() => closeModal(null))}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {modal.title && <h3 className="modal-title">{modal.title}</h3>}
            {modal.message && <p className="modal-message">{modal.message}</p>}

            {(modal.type === "prompt" || modal.type === "prompt2") && (
              <input
                className="modal-input"
                type="text"
                placeholder={modal.placeholder || ""}
                value={modal.inputVal}
                onChange={(e) => setModal(prev => ({ ...prev, inputVal: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && modal.type === "prompt" && modal.inputVal) closeModal(modal.inputVal);
                }}
                autoFocus
              />
            )}
            {modal.type === "prompt2" && (
              <input
                className="modal-input"
                type="password"
                placeholder={modal.placeholder2 || ""}
                value={modal.inputVal2}
                onChange={(e) => setModal(prev => ({ ...prev, inputVal2: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && modal.inputVal && modal.inputVal2) closeModal({ val1: modal.inputVal, val2: modal.inputVal2 });
                }}
              />
            )}

            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={() => closeModal(null)}>취소</button>
              {modal.type === "confirm" && (
                <button className={`modal-btn ok ${modal.danger ? "danger" : ""}`} onClick={() => closeModal(true)}>확인</button>
              )}
              {modal.type === "prompt" && (
                <button className="modal-btn ok" disabled={!modal.inputVal} onClick={() => closeModal(modal.inputVal)}>확인</button>
              )}
              {modal.type === "prompt2" && (
                <button className="modal-btn ok" disabled={!modal.inputVal || !modal.inputVal2} onClick={() => closeModal({ val1: modal.inputVal, val2: modal.inputVal2 })}>확인</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 자세 미리보기 오버레이 */}
      {previewImage && (
        <div className="preview-overlay" {...overlayDismissHandlers(() => setPreviewImage(null))}>
          <img src={previewImage} alt="자세 미리보기" />
          <button className="preview-close" onClick={() => setPreviewImage(null)} aria-label="닫기">
            <FontAwesomeIcon icon={ICONS.close} />
          </button>
        </div>
      )}

      {/* 로그인 모달 (통합 — 시스템/학교 자동 판별) */}
      {loginModal && (
        <div className="login-overlay" {...overlayDismissHandlers(() => { setLoginModal(null); setLoginError(""); })}>
          <div className="login-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="login-close"
              onClick={() => { setLoginModal(null); setLoginError(""); }}
              aria-label="닫기"
            >
              <FontAwesomeIcon icon={ICONS.close} />
            </button>

            <div className="login-brand">
              <div className="login-icon">
                <FontAwesomeIcon icon={ICONS.adminLogin} />
              </div>
              <div className="login-brand-text">
                <div className="login-eyebrow">LOGIN</div>
                <div className="login-title">관리자 로그인</div>
              </div>
            </div>

            <div className="login-field">
              <label>아이디 또는 학교명</label>
              <input
                type="text"
                className="login-input"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && loginPassword) handleUnifiedLogin(); }}
                placeholder="예) root · 양양초등학교"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="login-field">
              <label>비밀번호</label>
              <input
                type="password"
                className="login-input"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnifiedLogin(); }}
                placeholder="비밀번호"
                autoComplete="current-password"
              />
            </div>
            {loginError && (
              <p className="login-error">
                <FontAwesomeIcon icon={ICONS.warn} /> {loginError}
              </p>
            )}
            <button
              className="login-submit"
              disabled={!loginUsername || !loginPassword || loginBusy}
              onClick={handleUnifiedLogin}
            >
              {loginBusy ? <><FontAwesomeIcon icon={ICONS.hourglass} spin /> 확인 중...</> : "로그인"}
            </button>
            <p className="login-hint">
              시스템 관리자 아이디 또는 학교명으로 로그인하세요.
            </p>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
