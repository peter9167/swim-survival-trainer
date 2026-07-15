/**
 * 아이콘 매핑 — FontAwesome Solid
 * 이모지 대신 이 모듈에서 아이콘을 import해 사용.
 */
import {
  // Navigation
  faArrowLeft,
  faChevronRight,
  faCheck,
  faXmark,
  faLock,
  faStar,
  faFlagCheckered,

  // Tab bar
  faPersonSwimming,
  faBookOpen,
  faGear,

  // Motions
  faFire,
  faShrimp,
  faHandsHelping,
  faDroplet,
  faWaterLadder,
  faWater,

  // Sea / safety
  faUmbrellaBeach,
  faLifeRing,
  faHeartPulse,
  faTriangleExclamation,
  faCircleExclamation,
  faShieldHalved,
  faVolumeHigh,

  // Sea dangers
  faTornado,
  faArrowDown,
  faMountain,

  // Learning / UI
  faGraduationCap,
  faLightbulb,
  faTrophy,
  faPlay,
  faCamera,
  faCircleQuestion,
  faBullseye,
  faSun,
  faCloud,

  // General
  faInfoCircle,
  faTriangleExclamation as faWarn,

  // Settings
  faSchool,
  faKey,
  faUnlock,
  faPlus,
  faVideo,
  faSpinner,
  faRotate,
  faCloudArrowUp,
  faFileExport,
  faFileImport,
  faTrash,
  faRightFromBracket,
  faHourglass,
} from "@fortawesome/free-solid-svg-icons";

export const ICONS = {
  // Nav
  back: faArrowLeft,
  next: faChevronRight,
  check: faCheck,
  close: faXmark,
  lock: faLock,
  star: faStar,
  flag: faFlagCheckered,

  // Tabs
  practice: faPersonSwimming,
  learn: faBookOpen,
  settings: faGear,

  // Motion icons (기존 이모지 → FA)
  motion_1: faFire,           // HELP 자세
  motion_2: faShrimp,         // 새우등뜨기
  motion_3: faHandsHelping,   // 구조 신호
  motion_4: faDroplet,        // 스컬링
  motion_5: faWaterLadder,    // 개헤엄
  motion_6: faWater,          // 누워뜨기

  // Content icons
  intro: faGraduationCap,
  safety: faShieldHalved,
  cpr: faHeartPulse,
  rip_current: faTornado,
  undertow: faArrowDown,
  terrain: faMountain,

  // Zones
  beach: faUmbrellaBeach,
  shallow: faWater,
  open: faLifeRing,
  danger: faTriangleExclamation,
  rescue: faHeartPulse,

  // UI
  question: faCircleQuestion,
  info: faInfoCircle,
  tip: faLightbulb,
  target: faBullseye,
  trophy: faTrophy,
  play: faPlay,
  camera: faCamera,
  sun: faSun,
  cloud: faCloud,
  warn: faCircleExclamation,

  // Settings (관리자/데이터)
  school: faSchool,
  adminLogin: faKey,
  adminLogout: faRightFromBracket,
  unlock: faUnlock,
  add: faPlus,
  record: faVideo,
  loading: faSpinner,
  refresh: faRotate,
  upload: faCloudArrowUp,
  exportFile: faFileExport,
  importFile: faFileImport,
  trash: faTrash,
  hourglass: faHourglass,
};

export { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
