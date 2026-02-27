/**
 * Exports the Markmap mindmap as a high-resolution PNG.
 *
 * Requires the HTML to have been generated first with demo/generate.mjs.
 * Headless Chromium is used for rendering so fonts, colours, and the
 * D3 layout all match the browser output exactly.
 *
 * Run from the repo root:
 *   node demo/export-png.mjs [input.html] [output.png]
 *
 * Defaults:
 *   input  → demo/bidirectional-demo.html
 *   output → demo/mindmap.png
 *
 * Environment:
 *   CHROME_PATH – override the Chromium/Chrome executable (optional)
 */

import { writeFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Device-pixel ratio used for the screenshot.  3× ≈ 288 DPI on a 96 DPI screen. */
const SCALE = 3;
/** White-space padding (CSS px) added around the tight content bounding box. */
const PADDING = 24;
/** Initial viewport large enough that all nodes are visible after fit(). */
const INITIAL_VIEWPORT = { width: 2400, height: 1600 };
/**
 * How long to wait (ms) after the first node appears before measuring positions.
 * Markmap's default D3 transition is 500 ms; adding a 200 ms buffer ensures the
 * animation has fully settled before getBoundingClientRect() is called.
 */
const TRANSITION_WAIT_MS = 700;

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------
const [, , inputArg, outputArg] = process.argv;

const htmlPath = inputArg
  ? resolve(process.cwd(), inputArg)
  : join(__dirname, 'bidirectional-demo.html');

const pngPath = outputArg
  ? resolve(process.cwd(), outputArg)
  : join(__dirname, 'mindmap.png');

if (!existsSync(htmlPath)) {
  throw new Error(
    `HTML file not found: ${htmlPath}\nRun "node demo/generate.mjs" first.`,
  );
}

// ---------------------------------------------------------------------------
// Locate Chromium
// ---------------------------------------------------------------------------
const CHROMIUM_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const executablePath = CHROMIUM_CANDIDATES.find(existsSync);
if (!executablePath) {
  throw new Error(
    'Could not find a Chromium/Chrome installation.\n' +
      'Install Google Chrome or Chromium, or set the CHROME_PATH environment variable.',
  );
}

// ---------------------------------------------------------------------------
// Render and screenshot
// ---------------------------------------------------------------------------
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();

  // A generous initial viewport ensures the mindmap's automatic fit() call
  // keeps every node visible so getBoundingClientRect() returns accurate values.
  await page.setViewport({
    ...INITIAL_VIEWPORT,
    deviceScaleFactor: SCALE,
  });

  // Force light colour scheme so the export always has dark text on a white
  // background, regardless of the OS/system dark-mode preference.
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'light' },
  ]);

  // Load the self-contained HTML (all JS/CSS inlined, no network needed).
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'domcontentloaded' });

  // Wait until at least one markmap node has been painted.
  await page.waitForFunction(
    () => document.querySelectorAll('g.markmap-node').length > 0,
    { timeout: 15_000 },
  );

  // Allow the D3 transition to finish before measuring positions.
  await new Promise((r) => setTimeout(r, TRANSITION_WAIT_MS));

  // Compute the tight bounding box of every rendered node and link.
  const bbox = await page.evaluate((pad) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    document
      .querySelectorAll('g.markmap-node, path.markmap-link')
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (minX > r.left) minX = r.left;
        if (minY > r.top) minY = r.top;
        if (maxX < r.right) maxX = r.right;
        if (maxY < r.bottom) maxY = r.bottom;
      });

    if (!isFinite(minX)) return null;

    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      width: maxX - minX + 2 * pad,
      height: maxY - minY + 2 * pad,
    };
  }, PADDING);

  if (!bbox) {
    throw new Error(
      'No markmap nodes found in the rendered page.\n' +
        'Verify that the HTML file contains a valid Markmap visualisation.',
    );
  }

  // Take the screenshot.  deviceScaleFactor is already set on the viewport, so
  // the clip coordinates are in CSS pixels and the output is SCALE× larger.
  const buffer = await page.screenshot({
    type: 'png',
    clip: {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    },
    omitBackground: false,
  });

  await writeFile(pngPath, buffer);

  const physW = Math.round(bbox.width * SCALE);
  const physH = Math.round(bbox.height * SCALE);
  console.log(`PNG written to ${pngPath}  (${physW}×${physH} px, ${SCALE}× DPI scale)`);
} finally {
  await browser.close();
}
