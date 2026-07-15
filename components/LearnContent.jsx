"use client";

import { useState } from "react";
import { LEARN_CONTENT } from "@/lib/learn";
import { ICONS, FontAwesomeIcon } from "@/lib/icons";
import { Mascot, MascotBubble } from "@/components/Mascot";

/**
 * LearnContent — 콘텐츠 상세 뷰 (intro/safety/cpr/이안류/저류/위험지형)
 * FontAwesome 아이콘 사용, 정보 카드 기반 구조.
 */
export function LearnContent({ contentId, onBack, onComplete }) {
  const content = LEARN_CONTENT[contentId];
  if (!content) return null;

  const isDanger = content.zone === "danger";
  const iconObj = ICONS[content.iconKey] || ICONS.info;

  return (
    <div className={`content-view ${isDanger ? "content-view-danger" : ""}`}>
      {/* Header (sticky) */}
      <header className="content-header">
        <button className="content-back" onClick={onBack} aria-label="뒤로">
          <FontAwesomeIcon icon={ICONS.back} />
        </button>
        <div className="content-header-icon">
          <FontAwesomeIcon icon={iconObj} />
        </div>
        <div className="content-header-text">
          <div className="content-header-eyebrow">
            {isDanger ? "위험 대응" : content.zone === "beach" ? "기초" : "응급"}
          </div>
          <h1 className="content-header-title">{content.title}</h1>
        </div>
      </header>

      <div className="content-body">
        {/* 마스코트 인사 */}
        <MascotBubble mood={isDanger ? "warn" : "wave"}>
          {content.mascotLine}
        </MascotBubble>

        {/* 인트로 */}
        {content.intro && (
          <div className="content-card content-intro">
            <div className="content-intro-mark">
              <FontAwesomeIcon icon={ICONS.info} />
            </div>
            <p>{content.intro}</p>
          </div>
        )}

        {/* 이안류 관련 특별 도해 */}
        {contentId === "rip_current" && <RipCurrentDiagram />}
        {contentId === "undertow" && <UndertowDiagram />}
        {contentId === "terrain" && <TerrainDiagram />}

        {/* 안전 규칙 그리드 */}
        {content.rules && (
          <div className="rules-grid">
            {content.rules.map((r, i) => (
              <div key={i} className="rule-card">
                <div className="rule-card-icon">
                  <FontAwesomeIcon icon={ICONS[r.iconKey] || ICONS.info} />
                </div>
                <div className="rule-card-title">{r.title}</div>
                <div className="rule-card-desc">{r.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* CPR: 스텝 */}
        {content.steps && (
          <div className="steps-list">
            {content.steps.map((s, i) => (
              <div key={s.n} className="step-row">
                <div className="step-row-track">
                  <div className="step-row-num">{s.n}</div>
                  {i < content.steps.length - 1 && <div className="step-row-line" />}
                </div>
                <div className="step-row-body">
                  <div className="step-row-title">{s.title}</div>
                  <div className="step-row-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {content.note && (
          <div className="content-note">
            <FontAwesomeIcon icon={ICONS.tip} />
            <span>{content.note}</span>
          </div>
        )}

        {/* 섹션들 */}
        {content.sections?.map((sec, i) => (
          <section key={i} className="content-section">
            <h2 className="content-section-heading">{sec.heading}</h2>
            {sec.body && <p className="content-section-body">{sec.body}</p>}
            {sec.items && (
              <ul className="content-list">
                {sec.items.map((it, j) => (
                  <li key={j}>
                    <span className="content-list-dot" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {/* 시나리오 퀴즈 */}
        {content.scenario && <ScenarioQuiz scenario={content.scenario} />}

        {/* 핵심 포인트 */}
        {content.keyPoints && (
          <div className="key-points-card">
            <div className="key-points-head">
              <FontAwesomeIcon icon={ICONS.star} />
              <span>꼭 기억하기</span>
            </div>
            <ul>
              {content.keyPoints.map((k, i) => (
                <li key={i}>
                  <FontAwesomeIcon icon={ICONS.check} />
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 완료 버튼 */}
        <button
          className="content-complete"
          onClick={() => {
            onComplete?.();
            onBack?.();
          }}
        >
          <FontAwesomeIcon icon={ICONS.check} />
          <span>다 배웠어요</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SVG 도해들 (이안류/저류/지형)
// ═══════════════════════════════════════════════════════════
function RipCurrentDiagram() {
  return (
    <div className="diagram-card">
      <div className="diagram-head">
        <span className="diagram-eyebrow">DIAGRAM</span>
        <div className="diagram-title">이안류가 이렇게 흘러요</div>
      </div>
      <svg viewBox="0 0 320 220" className="diagram-svg">
        <defs>
          <linearGradient id="ripBeach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="ripSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0284c7" />
            <stop offset="1" stopColor="#0c4a6e" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="320" height="60" fill="url(#ripBeach)" />
        <rect x="0" y="60" width="320" height="160" fill="url(#ripSea)" />

        {[80, 130, 240].map((x, i) => (
          <g key={i}>
            <path
              d={`M ${x} 200 Q ${x} 150, ${x} 80`}
              stroke="#7dd3fc"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d={`M ${x - 5} 90 L ${x} 78 L ${x + 5} 90`}
              stroke="#7dd3fc"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        ))}

        <g className="rip-flow">
          <path
            d="M 175 70 Q 175 130, 175 210"
            stroke="#fb7185"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 168 195 L 175 210 L 182 195"
            stroke="#fb7185"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        <text x="24" y="35" fontSize="12" fontWeight="700" fill="#78350f">해변</text>
        <text x="175" y="150" fontSize="11" fontWeight="800" fill="white" textAnchor="middle">이안류</text>
        <text x="175" y="163" fontSize="9" fill="#fecaca" textAnchor="middle">(바다 쪽으로!)</text>

        <g>
          <path
            d="M 175 100 L 120 100"
            stroke="#34d399"
            strokeWidth="4"
            strokeDasharray="6 4"
            fill="none"
          />
          <path
            d="M 130 94 L 120 100 L 130 106"
            stroke="#34d399"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <text x="90" y="94" fontSize="10" fontWeight="700" fill="#34d399">옆으로!</text>
        </g>
      </svg>
      <div className="diagram-legend">
        <span className="legend-item">
          <span className="legend-dot legend-danger" />
          이안류 (위험)
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-safe" />
          안전한 탈출 방향
        </span>
      </div>
    </div>
  );
}

function UndertowDiagram() {
  return (
    <div className="diagram-card">
      <div className="diagram-head">
        <span className="diagram-eyebrow">DIAGRAM</span>
        <div className="diagram-title">저류는 발 밑에서 잡아당겨요</div>
      </div>
      <svg viewBox="0 0 320 200" className="diagram-svg">
        <defs>
          <linearGradient id="undBeach" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="undSea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7dd3fc" />
            <stop offset="1" stopColor="#0c4a6e" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="320" height="40" fill="#e0f2fe" />
        <rect x="0" y="40" width="320" height="130" fill="url(#undSea)" />
        <path d="M 0 170 Q 80 165 160 170 T 320 170 L 320 200 L 0 200 Z" fill="url(#undBeach)" />

        <path
          d="M 0 46 Q 40 40 80 46 T 160 46 T 240 46 T 320 46"
          stroke="#e0f2fe"
          strokeWidth="2"
          fill="none"
        />

        <g transform="translate(200 100)">
          <circle cx="0" cy="0" r="7" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
          <rect x="-4" y="7" width="8" height="18" fill="#3b82f6" rx="2" />
          <rect x="-4" y="25" width="3" height="12" fill="#0c4a6e" />
          <rect x="1" y="25" width="3" height="12" fill="#0c4a6e" />
        </g>

        <g>
          {[60, 120, 240, 280].map((x, i) => (
            <path
              key={i}
              d={`M ${x} 155 Q ${x - 10} 168 ${x - 20} 175`}
              stroke="#fb7185"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
          ))}
          <path
            d="M 180 165 L 220 165"
            stroke="#fb7185"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 190 158 L 180 165 L 190 172"
            stroke="#fb7185"
            strokeWidth="4"
            fill="none"
          />
        </g>

        <text x="10" y="30" fontSize="11" fontWeight="700" fill="#075985">바다 표면</text>
        <text x="10" y="188" fontSize="11" fontWeight="700" fill="#78350f">모래 바닥</text>
        <text x="240" y="140" fontSize="10" fontWeight="800" fill="#fb7185">저류 (바닥)</text>
      </svg>
      <div className="diagram-caption">
        표면은 잔잔해 보여도 바닥에는 몸을 잡아당기는 흐름이 있어요.
      </div>
    </div>
  );
}

function TerrainDiagram() {
  return (
    <div className="diagram-card">
      <div className="diagram-head">
        <span className="diagram-eyebrow">DIAGRAM</span>
        <div className="diagram-title">모래 언덕과 골짜기</div>
      </div>
      <svg viewBox="0 0 320 200" className="diagram-svg">
        <defs>
          <linearGradient id="tSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bae6fd" />
            <stop offset="1" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id="tWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#0c4a6e" />
          </linearGradient>
        </defs>
        <rect width="320" height="60" fill="url(#tSky)" />
        <rect y="60" width="320" height="140" fill="url(#tWater)" />

        <path
          d="M 0 180 Q 30 150 60 155 Q 90 165 120 130 Q 150 100 180 110 Q 210 130 240 100 Q 270 80 320 110 L 320 200 L 0 200 Z"
          fill="#fbbf24"
          stroke="#78350f"
          strokeWidth="1.5"
        />

        <g transform="translate(50 130)">
          <circle cx="0" cy="0" r="6" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
          <rect x="-4" y="6" width="8" height="14" fill="#22c55e" rx="2" />
        </g>
        <text x="50" y="115" fontSize="9" fontWeight="700" fill="#22c55e" textAnchor="middle">안전</text>

        <g transform="translate(155 90)">
          <circle cx="0" cy="0" r="6" fill="#fecaca" stroke="#7f1d1d" strokeWidth="1.5" />
          <rect x="-4" y="6" width="8" height="14" fill="#fb7185" rx="2" />
        </g>
        <text x="155" y="75" fontSize="9" fontWeight="700" fill="#fb7185" textAnchor="middle">
          갑자기 깊어짐!
        </text>
        <path
          d="M 155 110 L 155 130"
          stroke="#fb7185"
          strokeWidth="3"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />

        <text x="240" y="185" fontSize="10" fontWeight="800" fill="#78350f">모래톱 언덕</text>
      </svg>
      <div className="diagram-caption">
        얕은 곳에서 놀다가 갑자기 깊은 구덩이로 미끄러질 수 있어요.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 시나리오 퀴즈
// ═══════════════════════════════════════════════════════════
function ScenarioQuiz({ scenario }) {
  const [picked, setPicked] = useState(null);
  const showAll = picked !== null;

  return (
    <div className="scenario">
      <div className="scenario-head">
        <div className="scenario-eyebrow">
          <FontAwesomeIcon icon={ICONS.target} />
          <span>미션</span>
        </div>
        <h3 className="scenario-title">{scenario.title}</h3>
      </div>

      <div className="scenario-question">
        <Mascot size={48} mood="wow" floating={false} />
        <p>{scenario.question}</p>
      </div>

      <div className="scenario-choices">
        {scenario.choices.map((c, i) => {
          const isPicked = picked === i;
          return (
            <button
              key={i}
              className={`scenario-choice ${isPicked ? (c.correct ? "correct" : "wrong") : ""} ${
                showAll && !isPicked ? "faded" : ""
              }`}
              onClick={() => setPicked(i)}
              disabled={showAll}
            >
              <span className="scenario-choice-mark">
                {isPicked ? (
                  <FontAwesomeIcon icon={c.correct ? ICONS.check : ICONS.close} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="scenario-choice-label">{c.label}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div
          className={`scenario-result ${
            scenario.choices[picked].correct ? "result-correct" : "result-wrong"
          }`}
        >
          <div className="scenario-result-icon">
            <FontAwesomeIcon
              icon={scenario.choices[picked].correct ? ICONS.check : ICONS.warn}
            />
          </div>
          <p>{scenario.choices[picked].result}</p>
          {!scenario.choices[picked].correct && (
            <button className="scenario-retry" onClick={() => setPicked(null)}>
              다시 도전
            </button>
          )}
        </div>
      )}
    </div>
  );
}
