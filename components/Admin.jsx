"use client";

import { useState, useEffect, useRef } from "react";
import { MOTIONS } from "@/lib/motions";

export default function Admin() {
  const [data, setData] = useState({});
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  // localStorage에서 데이터 로드
  function loadData() {
    const result = {};
    for (let i = 1; i <= 6; i++) {
      const raw = localStorage.getItem(`swim_knn_${i}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          result[i] = parsed;
        } catch {
          result[i] = null;
        }
      } else {
        result[i] = null;
      }
    }
    setData(result);
  }

  useEffect(() => {
    loadData();
  }, []);

  function showMsg(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  }

  // 통계 계산
  function getStats(motionId) {
    const d = data[motionId];
    if (!d) return { total: 0, steps: {} };
    const steps = {};
    let total = 0;
    for (const [label, samples] of Object.entries(d)) {
      steps[label] = samples.length;
      total += samples.length;
    }
    return { total, steps };
  }

  // 전체 내보내기
  function exportAll() {
    const exportData = {};
    for (let i = 1; i <= 6; i++) {
      const raw = localStorage.getItem(`swim_knn_${i}`);
      if (raw) exportData[i] = JSON.parse(raw);
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swim-trainer-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg("✅ 전체 데이터 내보내기 완료");
  }

  // 개별 내보내기
  function exportMotion(id) {
    const raw = localStorage.getItem(`swim_knn_${id}`);
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `swim-motion-${id}-${MOTIONS[id].name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg(`✅ ${MOTIONS[id].name} 데이터 내보내기 완료`);
  }

  // 가져오기
  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        let count = 0;
        for (const [id, samples] of Object.entries(imported)) {
          if (parseInt(id) >= 1 && parseInt(id) <= 6) {
            localStorage.setItem(`swim_knn_${id}`, JSON.stringify(samples));
            count++;
          }
        }
        loadData();
        showMsg(`✅ ${count}개 동작 데이터 가져오기 완료`);
      } catch {
        showMsg("❌ 파일 형식이 올바르지 않습니다");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // 개별 삭제
  function deleteMotion(id) {
    if (!confirm(`"${MOTIONS[id].name}" 학습 데이터를 삭제할까요?`)) return;
    localStorage.removeItem(`swim_knn_${id}`);
    loadData();
    showMsg(`🗑 ${MOTIONS[id].name} 데이터 삭제됨`);
  }

  // 전체 삭제
  function deleteAll() {
    if (!confirm("모든 학습 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다."))
      return;
    for (let i = 1; i <= 6; i++) {
      localStorage.removeItem(`swim_knn_${i}`);
    }
    loadData();
    showMsg("🗑 전체 데이터 삭제 완료");
  }

  const totalSamples = Object.keys(data).reduce(
    (sum, id) => sum + getStats(parseInt(id)).total,
    0
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <a href="/" style={styles.backLink}>
          ← 트레이너로 돌아가기
        </a>
        <h1 style={styles.title}>⚙ 학습 데이터 관리</h1>
        <p style={styles.subtitle}>
          저장 위치: <b>브라우저 localStorage</b> (이 기기/브라우저에서만 유효)
        </p>
      </div>

      {/* 메시지 */}
      {message && <div style={styles.toast}>{message}</div>}

      {/* 전체 통계 */}
      <div style={styles.statsBar}>
        <span>전체 샘플: <b>{totalSamples}개</b></span>
        <span>학습된 동작: <b>{Object.keys(data).filter((id) => data[id]).length}/6</b></span>
      </div>

      {/* 전체 액션 */}
      <div style={styles.actions}>
        <button style={styles.btnPrimary} onClick={exportAll} disabled={totalSamples === 0}>
          📥 전체 내보내기 (JSON)
        </button>
        <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()}>
          📤 데이터 가져오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: "none" }}
        />
        <button style={styles.btnDanger} onClick={deleteAll} disabled={totalSamples === 0}>
          🗑 전체 삭제
        </button>
      </div>

      {/* 동작별 카드 */}
      <div style={styles.grid}>
        {Object.entries(MOTIONS).map(([id, m]) => {
          const stats = getStats(parseInt(id));
          const hasData = stats.total > 0;

          return (
            <div key={id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <div>
                  <div style={styles.cardTitle}>{m.name}</div>
                  <div style={styles.cardSub}>{m.sub}</div>
                </div>
                <span style={{
                  ...styles.badge,
                  background: hasData ? "#10b98120" : "#64748b20",
                  color: hasData ? "#34d399" : "#94a3b8",
                }}>
                  {hasData ? `${stats.total}개` : "미학습"}
                </span>
              </div>

              {hasData && (
                <div style={styles.stepList}>
                  {Object.entries(stats.steps).map(([step, count]) => (
                    <div key={step} style={styles.stepRow}>
                      <span style={styles.stepName}>{step}</span>
                      <div style={styles.miniBar}>
                        <div
                          style={{
                            ...styles.miniBarFill,
                            width: `${Math.min((count / 15) * 100, 100)}%`,
                            background: count >= 10 ? "#10b981" : count >= 5 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                      <span style={styles.stepCount}>{count}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={styles.cardActions}>
                <button
                  style={styles.btnSmall}
                  onClick={() => exportMotion(parseInt(id))}
                  disabled={!hasData}
                >
                  📥 내보내기
                </button>
                <button
                  style={{ ...styles.btnSmall, color: "#ef4444" }}
                  onClick={() => deleteMotion(parseInt(id))}
                  disabled={!hasData}
                >
                  🗑 삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 저장소 안내 */}
      <div style={styles.info}>
        <h3>💡 저장소 안내</h3>
        <p>• 학습 데이터는 이 <b>브라우저의 localStorage</b>에만 저장됩니다.</p>
        <p>• 다른 기기나 브라우저에서는 데이터가 보이지 않습니다.</p>
        <p>• 브라우저 캐시를 삭제하면 데이터가 사라질 수 있습니다.</p>
        <p>• <b>내보내기</b> 기능으로 JSON 파일을 백업해두세요.</p>
        <p>• 다른 기기에서 <b>가져오기</b>로 복원할 수 있습니다.</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    background: "#0a0e17",
    color: "#e2e8f0",
    minHeight: "100vh",
  },
  header: { marginBottom: 24 },
  backLink: {
    color: "#22d3ee",
    fontSize: 14,
    textDecoration: "none",
  },
  title: { fontSize: 24, fontWeight: 800, margin: "8px 0 4px" },
  subtitle: { fontSize: 13, color: "#94a3b8" },
  toast: {
    padding: "10px 16px",
    background: "#1e293b",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
    textAlign: "center",
    border: "1px solid #334155",
  },
  statsBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "#1e293b",
    borderRadius: 8,
    fontSize: 14,
    marginBottom: 16,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  btnPrimary: {
    padding: "8px 16px",
    background: "#22d3ee20",
    color: "#22d3ee",
    border: "1px solid #22d3ee40",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnSecondary: {
    padding: "8px 16px",
    background: "#10b98120",
    color: "#34d399",
    border: "1px solid #10b98140",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnDanger: {
    padding: "8px 16px",
    background: "#ef444420",
    color: "#f87171",
    border: "1px solid #ef444440",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340, 1fr))",
    gap: 12,
  },
  card: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: 700 },
  cardSub: { fontSize: 12, color: "#94a3b8" },
  badge: {
    marginLeft: "auto",
    padding: "2px 10px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
  },
  stepList: { marginBottom: 12 },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 0",
    fontSize: 13,
  },
  stepName: { width: 80, color: "#94a3b8" },
  miniBar: {
    flex: 1,
    height: 6,
    background: "#0f172a",
    borderRadius: 3,
    overflow: "hidden",
  },
  miniBarFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  stepCount: { width: 30, textAlign: "right", fontSize: 12, fontWeight: 600 },
  cardActions: {
    display: "flex",
    gap: 8,
    borderTop: "1px solid #334155",
    paddingTop: 12,
  },
  btnSmall: {
    padding: "4px 12px",
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
  },
  info: {
    marginTop: 32,
    padding: 20,
    background: "#1e293b",
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 2,
    color: "#94a3b8",
  },
};
