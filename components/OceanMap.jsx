"use client";

import { LEARNING_PATH, ZONES, nodeIconKey, MASCOT_NAME } from "@/lib/learn";
import { ICONS, FontAwesomeIcon } from "@/lib/icons";
import { Mascot } from "@/components/Mascot";

/**
 * OceanMap — Duolingo 스타일 세로 학습 여정
 *
 * 구조:
 *  - 상단 진행바 (X/12 완료)
 *  - 세로 지그재그 노드 12개
 *  - 노드 사이 점선 연결
 *  - 존 전환 지점에 존 배너
 *  - 각 노드는 상태(잠김/현재/완료)에 따라 스타일 변화
 */
export function OceanMap({ onSelect, completed = new Set() }) {
  const total = LEARNING_PATH.length;
  const doneCount = LEARNING_PATH.filter((n) =>
    completed.has(`${n.type}-${n.id}`)
  ).length;

  // 현재 노드(첫 미완료)
  const currentIdx = LEARNING_PATH.findIndex(
    (n) => !completed.has(`${n.type}-${n.id}`)
  );

  // 진행률
  const progress = Math.round((doneCount / total) * 100);

  return (
    <div className="ocean-path">
      {/* 상단 진행 헤더 */}
      <ProgressHeader
        doneCount={doneCount}
        total={total}
        progress={progress}
      />

      {/* 세로 여정 */}
      <div className="path-track">
        {LEARNING_PATH.map((node, i) => {
          const key = `${node.type}-${node.id}`;
          const isDone = completed.has(key);
          const isCurrent = i === currentIdx;

          // 존 전환 지점(직전 노드와 zone이 다를 때) 배너 삽입
          const isFirstOfZone = i === 0 || LEARNING_PATH[i - 1].zone !== node.zone;

          return (
            <div className="path-item" key={i}>
              {isFirstOfZone && <ZoneBanner zone={node.zone} />}
              <PathNode
                node={node}
                index={i}
                isDone={isDone}
                isCurrent={isCurrent}
                onSelect={onSelect}
              />
            </div>
          );
        })}

        {/* 결승선 */}
        <div className="path-finish">
          <div className="path-finish-icon">
            <FontAwesomeIcon icon={ICONS.trophy} />
          </div>
          <div className="path-finish-text">
            <div className="path-finish-title">모든 여정 완료</div>
            <div className="path-finish-sub">진짜 바다에서도 안전!</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function ProgressHeader({ doneCount, total, progress }) {
  return (
    <div className="path-header">
      <div className="path-header-top">
        <div className="path-header-mascot">
          <Mascot size={64} mood="wave" />
        </div>
        <div className="path-header-text">
          <div className="path-header-hello">안녕! 나는 {MASCOT_NAME}</div>
          <div className="path-header-title">함께 바다 여행을 떠나요</div>
        </div>
      </div>

      <div className="path-progress">
        <div className="path-progress-bar">
          <div
            className="path-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="path-progress-meta">
          <span className="path-progress-count">
            <FontAwesomeIcon icon={ICONS.check} />
            <strong>{doneCount}</strong> / {total} 완료
          </span>
          <span className="path-progress-pct">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function ZoneBanner({ zone }) {
  const meta = ZONES[zone];
  return (
    <div className={`zone-banner zone-banner-${zone}`}>
      <div className="zone-banner-line" style={{ background: meta.color }} />
      <div className="zone-banner-badge">
        <FontAwesomeIcon icon={ICONS[zone]} />
        <div className="zone-banner-labels">
          <div className="zone-banner-name">{meta.name}</div>
          <div className="zone-banner-desc">{meta.desc}</div>
        </div>
      </div>
      <div className="zone-banner-line" style={{ background: meta.color }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function PathNode({ node, index, isDone, isCurrent, onSelect }) {
  const meta = ZONES[node.zone];
  const iconKey = nodeIconKey(node);
  const icon = ICONS[iconKey] || ICONS.question;

  // 지그재그 오프셋 (6개 사이클)
  const cycle = index % 6;
  const offsets = [0, 40, 60, 40, 0, -40];
  const offset = offsets[cycle];

  const state = isDone ? "done" : isCurrent ? "current" : "unlocked";

  return (
    <div
      className={`path-node-wrap state-${state}`}
      style={{ transform: `translateX(${offset}px)` }}
    >
      {/* 연결선 (위쪽) — 첫 노드 제외 */}
      {index > 0 && <div className="path-connector" aria-hidden="true" />}

      <button
        className="path-node"
        onClick={() => onSelect?.(node)}
        style={{
          "--node-color": meta.color,
          "--node-accent": meta.accent,
        }}
      >
        <div className="path-node-ring">
          <div className="path-node-icon">
            <FontAwesomeIcon icon={icon} />
          </div>
          {isDone && (
            <div className="path-node-check">
              <FontAwesomeIcon icon={ICONS.check} />
            </div>
          )}
          {isCurrent && <div className="path-node-pulse" aria-hidden="true" />}
        </div>
        <div className="path-node-label">{node.label}</div>
        {isCurrent && (
          <div className="path-node-current-tag">
            <FontAwesomeIcon icon={ICONS.play} />
            <span>다음</span>
          </div>
        )}
      </button>
    </div>
  );
}
