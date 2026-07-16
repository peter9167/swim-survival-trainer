import "./globals.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { config } from "@fortawesome/fontawesome-svg-core";
config.autoAddCss = false;

export const metadata = {
  title: "생존수영 트레이너",
  description: "AI 기반 실시간 생존수영 동작 분석 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "생존수영",
    startupImage: [
      { url: "/icons/pwa/apple-touch-icon.png" },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/pwa/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/pwa/apple-touch-icon.png", sizes: "180x180" },
    ],
    shortcut: "/icons/pwa/favicon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0ea5e9",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Critical inline reset — globals.css 로드 전 FOUC(흰 배경 깜빡임) 방지 */}
        <style>{`
          html, body {
            margin: 0;
            padding: 0;
            background: #0a0e17;
            color: #f1f5f9;
            width: 100%;
            min-height: 100vh;
            min-height: 100dvh;
          }
          body { overflow-x: hidden; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
