/**
 * 앱 아이콘 PNG 리사이즈 (sharp 사용)
 * ─────────────────────────────────────────────────────────
 * 소스: public/app-icon.png (마스터, 1000px 이상 권장)
 * 결과: public/icons/pwa/ 에 다양한 크기 저장
 *
 * 실행: npm run icons
 * ─────────────────────────────────────────────────────────
 */

import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const srcPath = path.join(projectRoot, "public", "app-icon.png");
const outputDir = path.join(projectRoot, "public", "icons", "pwa");

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon.png", size: 32 },
];

async function ensureDir(dir) {
  try { await access(dir); }
  catch { await mkdir(dir, { recursive: true }); }
}

async function main() {
  await ensureDir(outputDir);
  console.log(`\n🎨 앱 아이콘 생성 시작 → ${outputDir}\n`);
  console.log(`  소스: ${srcPath}\n`);

  for (const { name, size } of SIZES) {
    const outPath = path.join(outputDir, name);
    await sharp(srcPath)
      .resize(size, size, {
        fit: "cover",              // 정사각형 유지, 필요시 crop
        position: "center",
        kernel: sharp.kernel.lanczos3, // 고품질 다운스케일
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outPath);
    console.log(`  ✓ ${name} (${size}×${size})`);
  }

  console.log(`\n✅ 완료! ${SIZES.length}개 아이콘 저장됨.`);
}

main().catch((err) => {
  console.error("❌ 오류:", err);
  process.exit(1);
});
