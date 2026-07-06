# nOffice

Cross-platform desktop office suite with deeply embedded local AI.

- **nWrite** — Word processor (TipTap/ProseMirror)
- **nSheet** — Spreadsheet (HyperFormula + PixiJS WebGL)
- **nSlides** — Presentations (SVG + Canvas)
- **nImg** — Image editor + paint + generative media (PixiJS)
- **nCode** — Multi-language IDE (Monaco Editor)

Built with **Tauri 2.x**, **React + TypeScript**, **pnpm + Turborepo**.

## Prerequisites

- Node.js 20 LTS
- pnpm 10
- Rust 1.81+
- Tauri system deps (see [Tauri docs](https://v2.tauri.app/start/prerequisites/))

## Getting Started

```bash
pnpm install
pnpm dev          # Run launcher in dev mode
pnpm tauri dev    # Run full Tauri app
```

## Build

```bash
pnpm build
pnpm tauri build  # Production build
```

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) and [VISION.md](docs/VISION.md).

## License

Proprietary — see LICENSE file.
