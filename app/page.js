import dynamic from "next/dynamic";

const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0e17",
        color: "#22d3ee",
        fontFamily: "'Pretendard', sans-serif",
        flexDirection: "column",
        gap: 20,
        zIndex: 9999,
        margin: 0,
      }}
    >
      {/* 파돌이 마스코트 SVG (Mascot.jsx의 축약본) */}
      <svg width="96" height="96" viewBox="0 0 120 120" fill="none" aria-label="파돌이">
        <defs>
          <linearGradient id="ld_body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="0.6" stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="ld_belly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0f2fe" />
            <stop offset="1" stopColor="#bae6fd" />
          </linearGradient>
        </defs>
        <ellipse cx="60" cy="108" rx="30" ry="4" fill="#000" opacity="0.15" />
        <path
          d="M20 62 C 20 40, 40 24, 62 24 C 90 24, 104 44, 104 62 C 104 82, 88 96, 66 96 C 42 96, 20 84, 20 62 Z"
          fill="url(#ld_body)"
          stroke="#0c4a6e"
          strokeWidth="1.5"
        />
        <path
          d="M32 70 C 40 92, 88 92, 96 72 C 92 82, 80 90, 66 90 C 50 90, 38 82, 32 70 Z"
          fill="url(#ld_belly)"
        />
        <path d="M16 60 C 4 50, 4 70, 14 74 L 22 66 Z" fill="#0369a1" stroke="#0c4a6e" strokeWidth="1.2" />
        <path d="M14 74 C 6 82, 8 88, 20 80 L 24 72 Z" fill="#0369a1" stroke="#0c4a6e" strokeWidth="1.2" />
        <path d="M56 22 C 58 10, 74 12, 76 30 Z" fill="#0369a1" stroke="#0c4a6e" strokeWidth="1.2" />
        <circle cx="76" cy="52" r="6" fill="white" />
        <circle cx="76" cy="52" r="3.5" fill="#0c1a2e" />
        <circle cx="77.5" cy="50.5" r="1.2" fill="white" />
        <path
          d="M84 64 Q 90 70 96 66"
          stroke="#0c1a2e"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>

      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
        생존수영 트레이너
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
        AI 모델을 불러오는 중...
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #1e293b",
          borderTopColor: "#22d3ee",
          borderRadius: "50%",
          animation: "loading-spin 0.8s linear infinite",
        }}
      />
      <style>{`
        @keyframes loading-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  ),
});

export default function Page() {
  return <App />;
}
