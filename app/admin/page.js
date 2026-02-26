import dynamic from "next/dynamic";

const Admin = dynamic(() => import("@/components/Admin"), {
  ssr: false,
  loading: () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0a0e17", color: "#94a3b8",
    }}>
      로딩 중...
    </div>
  ),
});

export default function AdminPage() {
  return <Admin />;
}
