# Markmap Bidirectional Demo Generator

Generates a fully self-contained, offline-capable HTML file that renders a bidirectional Markmap mindmap from a Markdown source file with YAML frontmatter.

The bidirectional layout places the first ⌈n/2⌉ top-level children on the **left** side of the root and the remaining children on the **right** side.

---

## Installation

This project is part of a pnpm monorepo. From the repository root, install all dependencies with:

```bash
pnpm install
```

Build the required packages:

```bash
pnpm build:types
pnpm build:js
```

> **Note:** Node.js ≥ 18 and pnpm ≥ 9 are required. Enable pnpm via corepack if it is not already on your PATH:
>
> ```bash
> corepack enable
> ```

---

## Generating the HTML

Run the generator from the **repository root**:

```bash
node demo/generate.mjs [input.md] [output.html]
```

| Argument | Default | Description |
|---|---|---|
| `input.md` | `demo/mindmap.md` | Path to the Markdown source file (may contain YAML frontmatter) |
| `output.html` | `demo/bidirectional-demo.html` | Path where the self-contained HTML file is written |

### Default (uses `demo/mindmap.md`)

```bash
node demo/generate.mjs
```

Output: `demo/bidirectional-demo.html`

### Custom input and output paths

```bash
node demo/generate.mjs path/to/my-map.md path/to/output.html
```

---

## Markdown file format

The Markdown source file may include an optional YAML frontmatter block under the `markmap` key to configure the visualisation:

```markdown
---
markmap:
  lineWidth: 2.5
  spacingVertical: 3
  spacingHorizontal: 30
  colorFreezeLevel: 2
  color:
   - black
   - "#797979"
   - "#d65f5f"
   - "#956cb4"
---

# Root node
## Left branch 1
- Item A
## Left branch 2
- Item B
## Right branch
- Item C
```

Supported frontmatter options (all optional):

| Option | Type | Description |
|---|---|---|
| `color` | `string[]` | Ordered list of branch colors |
| `colorFreezeLevel` | `number` | Depth at which colour cycling stops |
| `lineWidth` | `number` | Connector line width (px) |
| `spacingHorizontal` | `number` | Horizontal spacing between levels (px) |
| `spacingVertical` | `number` | Vertical spacing between sibling nodes (px) |
| `duration` | `number` | Animation duration (ms) |
| `initialExpandLevel` | `number` | Initial depth to expand (`-1` = all) |
| `maxWidth` | `number` | Maximum node label width (px) |
| `zoom` | `boolean` | Enable/disable zoom |
| `pan` | `boolean` | Enable/disable pan |

---

## Example

The included `demo/mindmap.md` file produces the following layout:

- **Left side:** Assessment (5), Classification (25)
- **Right side:** Detection (14)

Generate it with:

```bash
node demo/generate.mjs
```

Then open `demo/bidirectional-demo.html` in any modern browser — no internet connection required.

The toolbar buttons provide:
- **Fit** – re-fit the diagram to the viewport
- **Get SVG** – export the current diagram as an SVG string (via `getSVG()`)
