"use client";

/**
 * 파돌이 — baby dolphin 마스코트
 * - SVG로 그린 친근한 아기 돌고래
 * - 크기(size)와 표정(mood)만 바꾸면 여러 상황에서 재사용
 * - mood: "happy" | "wave" | "wow" | "warn" | "sleep"
 */
export function Mascot({ size = 96, mood = "happy", className = "", floating = true }) {
  const eye = mood === "sleep" ? "sleep" : mood === "wow" ? "wide" : "open";
  const mouth =
    mood === "wow" ? "o" : mood === "warn" ? "flat" : mood === "sleep" ? "sleep" : "smile";

  return (
    <svg
      className={`mascot ${floating ? "mascot-floating" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="파돌이 마스코트"
    >
      <defs>
        <linearGradient id="dolphinBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.6" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="dolphinBelly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#bae6fd" />
        </linearGradient>
        <radialGradient id="dolphinCheek" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fda4af" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fda4af" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 물 방울 그림자 */}
      <ellipse cx="60" cy="108" rx="30" ry="4" fill="#000" opacity="0.12" />

      {/* 몸통 (뒤 꼬리부터 이어지는 캡슐 형태) */}
      <path
        d="M20 62
           C 20 40, 40 24, 62 24
           C 90 24, 104 44, 104 62
           C 104 82, 88 96, 66 96
           C 42 96, 20 84, 20 62 Z"
        fill="url(#dolphinBody)"
        stroke="#0c4a6e"
        strokeWidth="1.5"
      />

      {/* 배 (아래쪽 밝은 부분) */}
      <path
        d="M32 70
           C 40 92, 88 92, 96 72
           C 92 82, 80 90, 66 90
           C 50 90, 38 82, 32 70 Z"
        fill="url(#dolphinBelly)"
      />

      {/* 꼬리 지느러미 */}
      <path
        d="M16 60
           C 4 50, 4 70, 14 74
           L 22 66 Z"
        fill="#0369a1"
        stroke="#0c4a6e"
        strokeWidth="1.2"
      />
      <path
        d="M14 74
           C 6 82, 8 88, 20 80
           L 24 72 Z"
        fill="#0369a1"
        stroke="#0c4a6e"
        strokeWidth="1.2"
      />

      {/* 등 지느러미 */}
      <path
        d="M56 22
           C 58 10, 74 12, 76 30 Z"
        fill="#0369a1"
        stroke="#0c4a6e"
        strokeWidth="1.2"
      />

      {/* 옆 지느러미 */}
      <path
        d="M46 68
           C 40 84, 58 88, 62 78 Z"
        fill="#0284c7"
        stroke="#0c4a6e"
        strokeWidth="1.2"
      />

      {/* 볼 홍조 */}
      <ellipse cx="80" cy="66" rx="9" ry="5" fill="url(#dolphinCheek)" />

      {/* 눈 */}
      {eye === "open" && (
        <>
          <circle cx="76" cy="52" r="6" fill="white" />
          <circle cx="76" cy="52" r="3.5" fill="#0c1a2e" />
          <circle cx="77.5" cy="50.5" r="1.2" fill="white" />
        </>
      )}
      {eye === "wide" && (
        <>
          <circle cx="76" cy="52" r="7" fill="white" />
          <circle cx="76" cy="52" r="4.5" fill="#0c1a2e" />
          <circle cx="77.5" cy="50" r="1.6" fill="white" />
        </>
      )}
      {eye === "sleep" && (
        <path
          d="M70 52 Q 76 56 82 52"
          stroke="#0c1a2e"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* 입 */}
      {mouth === "smile" && (
        <path
          d="M84 64 Q 90 70 96 66"
          stroke="#0c1a2e"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {mouth === "o" && (
        <ellipse cx="92" cy="66" rx="3" ry="4" fill="#0c1a2e" />
      )}
      {mouth === "flat" && (
        <path
          d="M84 66 L 96 66"
          stroke="#0c1a2e"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      {mouth === "sleep" && (
        <path
          d="M86 66 Q 90 68 94 66"
          stroke="#0c1a2e"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* 물 방울 (wave 무드) */}
      {mood === "wave" && (
        <>
          <circle cx="108" cy="30" r="3.5" fill="#7dd3fc" opacity="0.85" />
          <circle cx="100" cy="18" r="2.2" fill="#7dd3fc" opacity="0.7" />
          <circle cx="114" cy="42" r="2" fill="#7dd3fc" opacity="0.7" />
        </>
      )}
      {mood === "warn" && (
        <>
          <text x="102" y="20" fontSize="14" fill="#fbbf24" fontWeight="800">!</text>
          <circle cx="106" cy="14" r="8" fill="none" stroke="#fbbf24" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

/**
 * 말풍선 — 마스코트가 말하는 것처럼 보이는 컴포넌트
 */
export function MascotBubble({ children, mood = "happy", side = "left" }) {
  return (
    <div className={`mascot-bubble mascot-bubble-${side}`}>
      <Mascot size={72} mood={mood} />
      <div className="mascot-bubble-text">
        <div className="mascot-bubble-name">파돌이</div>
        <div className="mascot-bubble-body">{children}</div>
      </div>
    </div>
  );
}
