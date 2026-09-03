/**
 * Renders public/youtube_thumbnail.html → public/youtube_thumbnail.png
 * Uses the Playwright browser already in devDependencies.
 *
 * Usage:  node scripts/render-thumbnail.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dir, '../public/youtube_thumbnail.html');
const outPath  = path.resolve(__dir, '../public/youtube_thumbnail.png');

(async () => {
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`);
  // wait for Google Fonts to load
  await page.waitForTimeout(1500);

  await page.screenshot({ path: outPath, type: 'png' });
  await browser.close();

  console.log(`Saved → ${outPath}`);
})();
