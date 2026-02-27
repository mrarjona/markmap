/**
 * Generates a self-contained bidirectional-demo.html from a Markdown source
 * file that contains a YAML frontmatter block with Markmap options.
 *
 * Run from the repo root after building:
 *   pnpm --filter markmap-view build
 *   node demo/generate.mjs [path/to/input.md] [path/to/output.html]
 *
 * Defaults:
 *   input  → demo/mindmap.md
 *   output → demo/bidirectional-demo.html
 *
 * The output is a fully self-contained HTML file that works offline.
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createRequire } from 'module';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Read the local markmap-view IIFE browser bundle (contains our new features).
const markmapViewBundle = await readFile(
  join(root, 'packages/markmap-view/dist/browser/index.js'),
  'utf8',
);

// Read D3 from local node_modules so the demo works without internet access.
// Resolve via the markmap-view package context so we always use the same D3
// version that the library was built against, regardless of pnpm store layout.
const _require = createRequire(
  join(root, 'packages/markmap-view/src/index.ts'),
);
const d3SrcPath = _require.resolve('d3');
const d3MinPath = join(dirname(d3SrcPath), '..', 'dist', 'd3.min.js');
if (!existsSync(d3MinPath)) {
  throw new Error(`D3 min bundle not found at ${d3MinPath}`);
}
const d3Bundle = await readFile(d3MinPath, 'utf8');

// Parse the research markdown (with frontmatter) using markmap-lib Transformer
// so the tree data and markmap options come directly from the source markdown.
const { Transformer } = await import(
  join(root, 'packages/markmap-lib/dist/index.js')
);
const transformer = new Transformer();

// Resolve input/output paths from optional CLI arguments.
const [, , inputArg, outputArg] = process.argv;
const inputPath = inputArg
  ? resolve(process.cwd(), inputArg)
  : join(__dirname, 'mindmap.md');
const outPath = outputArg
  ? resolve(process.cwd(), outputArg)
  : join(__dirname, 'bidirectional-demo.html');

if (!existsSync(inputPath)) {
  throw new Error(`Input Markdown file not found: ${inputPath}`);
}

const markdown = await readFile(inputPath, 'utf8');
const { root: sampleData, frontmatter } = transformer.transform(markdown);
const markmapOptions = frontmatter?.markmap ?? {};

const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Bidirectional Markmap Demo</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html { font-family: ui-sans-serif, system-ui, sans-serif; }
body { display: flex; flex-direction: column; height: 100vh; }
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f4f4f5;
  border-bottom: 1px solid #e4e4e7;
  font-size: 14px;
}
#toolbar h1 { font-size: 15px; font-weight: 600; margin-right: 8px; }
button {
  padding: 4px 12px;
  border: 1px solid #a1a1aa;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
button:hover { background: #e4e4e7; }
#mindmap { display: block; flex: 1; width: 100%; }
.markmap-dark { background: #27272a; color: white; }
#svg-output {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  z-index: 10;
  align-items: center;
  justify-content: center;
}
#svg-output.open { display: flex; }
#svg-box {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  max-width: 80vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#svg-box textarea {
  width: 60vw;
  height: 50vh;
  font-family: monospace;
  font-size: 12px;
  resize: none;
  border: 1px solid #d4d4d8;
  border-radius: 4px;
  padding: 8px;
}
#close-svg { align-self: flex-end; }
</style>
</head>
<body>
<div id="toolbar">
  <h1>Bidirectional Layout Demo</h1>
  <button id="btn-fit">Fit</button>
  <button id="btn-get-svg">Get SVG</button>
  <span style="color:#71717a;font-size:12px">
    Assessment &amp; Classification → left &nbsp;|&nbsp; Detection → right
    (first ⌈n/2⌉ children go left, rest go right)
  </span>
</div>
<svg id="mindmap"></svg>

<!-- SVG output overlay -->
<div id="svg-output">
  <div id="svg-box">
    <div style="font-weight:600">SVG markup from getSVG()</div>
    <textarea id="svg-text" readonly></textarea>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="btn-download-svg">Download .svg</button>
      <button id="close-svg">Close</button>
    </div>
  </div>
</div>

<!-- D3 v7 (inlined for fully offline use) -->
<script>
${d3Bundle}
</script>

<!-- markmap-view browser bundle (local build with bidirectional layout + getSVG()) -->
<script>
${markmapViewBundle}
</script>

<script>
(function () {
  const { Markmap, deriveOptions } = window.markmap;

  // Tree data and options parsed from markdown frontmatter at build time.
  const data = ${JSON.stringify(sampleData, null, 2)};
  const options = ${JSON.stringify(markmapOptions, null, 2)};

  // Prefer dark mode if the OS is set to it.
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('markmap-dark');
  }

  // Create the markmap using options derived from the markdown frontmatter.
  const mm = Markmap.create('svg#mindmap', deriveOptions(options), data);

  // Fit button.
  document.getElementById('btn-fit').addEventListener('click', () => mm.fit());

  // Get SVG button – calls the new getSVG() method.
  document.getElementById('btn-get-svg').addEventListener('click', () => {
    const svgCode = mm.getSVG();
    document.getElementById('svg-text').value = svgCode;
    document.getElementById('svg-output').classList.add('open');
  });

  // Download SVG button.
  document.getElementById('btn-download-svg').addEventListener('click', () => {
    const svgCode = document.getElementById('svg-text').value;
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'markmap-bidirectional.svg';
    a.click();
  });

  // Close overlay.
  document.getElementById('close-svg').addEventListener('click', () => {
    document.getElementById('svg-output').classList.remove('open');
  });
  document.getElementById('svg-output').addEventListener('click', (e) => {
    if (e.target === e.currentTarget)
      document.getElementById('svg-output').classList.remove('open');
  });
})();
</script>
</body>
</html>
`;

await writeFile(outPath, html, 'utf8');
console.log('Demo written to', outPath);
