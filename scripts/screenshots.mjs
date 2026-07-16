/**
 * 스크린샷 자동 캡처 스크립트
 * ─────────────────────────────────────────────────────────
 * 사용법:
 *   1) 별도 터미널에서: npm run dev  (localhost:3000 실행 유지)
 *   2) 이 스크립트 실행: npm run screenshots
 *      또는: node scripts/screenshots.mjs
 *
 * 환경변수:
 *   SWIM_ROOT_USER      root 계정 아이디 (기본: root)
 *   SWIM_ROOT_PASSWORD  root 비밀번호 (기본: ROOT_CREDENTIALS.md에서 자동 파싱)
 *   SWIM_URL            앱 URL (기본: http://localhost:3000)
 *
 * 결과: docs/screenshots/ 에 PNG 파일들 저장
 * ─────────────────────────────────────────────────────────
 */

import { chromium } from "playwright";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "docs", "screenshots");

// ─────────────────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────────────────
const URL = process.env.SWIM_URL || "http://localhost:3000";
const ROOT_USER = process.env.SWIM_ROOT_USER || "root";

// ROOT_CREDENTIALS.md 에서 비밀번호 파싱 (env 미설정시)
async function resolvePassword() {
  if (process.env.SWIM_ROOT_PASSWORD) return process.env.SWIM_ROOT_PASSWORD;
  const credPath = path.join(projectRoot, "ROOT_CREDENTIALS.md");
  if (!existsSync(credPath)) {
    console.warn("⚠ ROOT_CREDENTIALS.md 없음 — 로그인 필요한 스크린샷은 스킵됨");
    return null;
  }
  const txt = await readFile(credPath, "utf-8");
  // 표에서 `Password | value` 추출
  const m = txt.match(/비밀번호 \(Password\)\*\*[^`]*`([^`]+)`/);
  if (m) return m[1];
  console.warn("⚠ ROOT_CREDENTIALS.md에서 비밀번호 파싱 실패");
  return null;
}

// Playwright viewport 프리셋
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },   // 노트북/데스크톱
  wide:    { width: 1920, height: 1080 },  // 대형 모니터
  tablet:  { width: 900, height: 1200 },   // 태블릿 세로
};

// ─────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────
async function ensureDir(dir) {
  try { await access(dir); }
  catch { await mkdir(dir, { recursive: true }); }
}

async function shot(page, filename, opts = {}) {
  const filepath = path.join(outputDir, filename);
  await page.screenshot({
    path: filepath,
    fullPage: opts.fullPage ?? false,
    animations: "disabled",
  });
  console.log(`  ✓ ${filename}`);
}

async function waitReady(page, ms = 800) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(ms);
}

// 로그인 (통합 로그인 폼)
async function login(page, username, password) {
  // 설정 탭으로 이동
  await page.click('.nav-item:has-text("설정")').catch(() => {});
  await waitReady(page, 300);

  // 로그인 버튼 (다양한 위치)
  const loginBtnSelectors = [
    '.login-required-card button:has-text("로그인")',
    '.settings-subtab-login',
    'button:has-text("관리자 로그인")',
  ];
  for (const sel of loginBtnSelectors) {
    if (await page.locator(sel).count() > 0) {
      await page.locator(sel).first().click();
      break;
    }
  }
  await page.waitForSelector('.login-card', { timeout: 3000 });

  // 폼 입력
  await page.fill('.login-input[autocomplete="username"]', username);
  await page.fill('.login-input[autocomplete="current-password"]', password);
  await page.click('.login-submit');

  // 로그인 완료 대기 (모달 사라지고 admin-status-card 등장)
  await page.waitForSelector('.login-card', { state: "hidden", timeout: 5000 });
  await waitReady(page, 500);
}

async function logout(page) {
  await page.click('.nav-item:has-text("설정")').catch(() => {});
  await waitReady(page, 300);
  // 계정 탭으로 (혹시 다른 탭에 있으면)
  const acc = page.locator('.settings-subtab:has-text("내 계정")');
  if (await acc.count() > 0) {
    await acc.click();
    await waitReady(page, 300);
  }
  const logoutBtn = page.locator('.admin-status-card button:has-text("로그아웃"), button:has-text("관리자 로그아웃")').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await waitReady(page, 500);
  }
}

async function goTab(page, label) {
  await page.click(`.nav-item:has-text("${label}")`);
  await waitReady(page, 400);
}

async function goSettingsSubtab(page, label) {
  const btn = page.locator(`.settings-subtab:has-text("${label}")`);
  if (await btn.count() > 0) {
    await btn.click();
    await waitReady(page, 300);
  }
}

// ─────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────
async function main() {
  await ensureDir(outputDir);
  const password = await resolvePassword();
  console.log(`\n📸 스크린샷 캡처 시작 — 저장: ${outputDir}\n`);
  console.log(`   URL: ${URL}`);
  console.log(`   Root user: ${ROOT_USER}`);
  console.log(`   Password: ${password ? "✓ 준비됨" : "✗ 없음 (로그인 스크린샷 스킵)"}\n`);

  const browser = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  // ═══ Desktop viewport ═══════════════════════════════════
  const ctx = await browser.newContext({
    viewport: VIEWPORTS.desktop,
    deviceScaleFactor: 1,
    permissions: ["camera", "microphone"],
    locale: "ko-KR",
  });
  const page = await ctx.newPage();

  console.log("▶ Desktop (1440×900)");
  await page.goto(URL);
  await waitReady(page, 3000); // 초기 로딩 + 모델 준비

  // ── 연습 탭 (기본 진입) ──
  console.log("  · 연습 탭");
  await goTab(page, "연습");
  await shot(page, "01-practice-motion-select.png", { fullPage: false });

  // ── 학습 탭 (오션 맵) ──
  console.log("  · 학습 탭 (오션 맵)");
  await goTab(page, "학습");
  await shot(page, "02-learn-ocean-path.png", { fullPage: false });
  await shot(page, "02b-learn-ocean-path-full.png", { fullPage: true });

  // 학습 - 이안류 콘텐츠
  console.log("  · 학습 - 이안류 상세");
  const ripNode = page.locator('.path-node:has-text("이안류")').first();
  if (await ripNode.count() > 0) {
    await ripNode.click();
    await waitReady(page, 500);
    await shot(page, "03-learn-rip-current.png", { fullPage: true });
    // 뒤로
    await page.click('.content-back');
    await waitReady(page, 400);
  }

  // ── 설정 탭 — 로그아웃 상태 ──
  console.log("  · 설정 (로그아웃 상태)");
  await goTab(page, "설정");
  await shot(page, "04-settings-logged-out.png", { fullPage: false });

  // 로그인 모달
  console.log("  · 로그인 모달");
  await page.click('.settings-subtab-login, .login-required-card button:has-text("로그인")').catch(() => {});
  await page.waitForSelector('.login-card', { timeout: 3000 });
  await shot(page, "05-login-modal.png", { fullPage: false });

  // ─ root 로그인 ─
  if (password) {
    console.log("  · Root 로그인");
    await page.fill('.login-input[autocomplete="username"]', ROOT_USER);
    await page.fill('.login-input[autocomplete="current-password"]', password);
    await page.click('.login-submit');
    await page.waitForSelector('.login-card', { state: "hidden", timeout: 5000 });
    await waitReady(page, 800);

    // 내 계정
    console.log("  · 설정 → 내 계정");
    await goSettingsSubtab(page, "내 계정");
    await shot(page, "06-settings-account-root.png", { fullPage: true });

    // 관리자 관리 (root 전용 — 내 계정 탭 안에서 아래로 스크롤)
    console.log("  · 관리자 관리 리스트 열기");
    const openAdminList = page.locator('button:has-text("관리자 목록 보기")');
    if (await openAdminList.count() > 0) {
      await openAdminList.click();
      await waitReady(page, 500);
      await shot(page, "07-admin-management.png", { fullPage: true });

      // 비밀번호 보기 토글
      const showPw = page.locator('button:has-text("비밀번호 보기")');
      if (await showPw.count() > 0) {
        await showPw.click();
        await waitReady(page, 300);
        await shot(page, "07b-admin-passwords-revealed.png", { fullPage: true });
        await page.locator('button:has-text("비밀번호 숨기기")').click();
      }
    }

    // 학교 관리
    console.log("  · 설정 → 학교 관리");
    await goSettingsSubtab(page, "학교 관리");
    await shot(page, "08-settings-schools.png", { fullPage: true });

    const openSchoolList = page.locator('button:has-text("학교 목록 보기")');
    if (await openSchoolList.count() > 0) {
      await openSchoolList.click();
      await waitReady(page, 500);
      await shot(page, "08b-schools-list.png", { fullPage: true });
    }

    // 데이터 관리
    console.log("  · 설정 → 데이터 관리");
    await goSettingsSubtab(page, "데이터 관리");
    await shot(page, "09-settings-data.png", { fullPage: true });

    // 기기 설정
    console.log("  · 설정 → 기기 설정");
    await goSettingsSubtab(page, "기기 설정");
    await shot(page, "10-settings-device.png", { fullPage: false });

    // 로그아웃 (다음 시나리오 준비)
    await logout(page).catch(() => {});
  }

  await ctx.close();

  // ═══ Tablet viewport (세로) ═════════════════════════════
  console.log("\n▶ Tablet (900×1200 세로)");
  const ctxTab = await browser.newContext({
    viewport: VIEWPORTS.tablet,
    permissions: ["camera", "microphone"],
    locale: "ko-KR",
  });
  const pageTab = await ctxTab.newPage();
  await pageTab.goto(URL);
  await waitReady(pageTab, 3000);

  console.log("  · 학습 탭 (태블릿)");
  await goTab(pageTab, "학습");
  await shot(pageTab, "11-tablet-learn.png", { fullPage: false });

  console.log("  · 연습 탭 (태블릿)");
  await goTab(pageTab, "연습");
  await shot(pageTab, "12-tablet-practice.png", { fullPage: false });

  await ctxTab.close();

  // ═══ 요약 ══════════════════════════════════════════════
  await browser.close();
  console.log(`\n✅ 완료! 저장 위치: ${outputDir}`);
  console.log("   docs/SETUP_GUIDE.html 에 이미지 참조 추가하려면:");
  console.log("   <img src=\"screenshots/01-practice-motion-select.png\" alt=\"...\">");
}

main().catch((err) => {
  console.error("❌ 오류:", err);
  process.exit(1);
});
