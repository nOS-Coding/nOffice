# nOffice Vision Document

## Project Overview

nOffice is a cross-platform desktop office suite built with Tauri 2.x (Rust backend, WebView frontend) and a pnpm + Turborepo monorepo. It targets Windows x64, Linux x64, and macOS ARM64/x64. The suite consists of five apps — nWrite (word processor), nSheet (spreadsheet), nSlides (presentations), nImg (image editor + paint + generative media), and nCode (multi-language IDE) — all launched from a single nOffice shell window. Each app runs as its own Tauri window spawned by the launcher. The shared UI lives in a `packages/ui-core` React + TypeScript design system consumed by all five apps. The build pipeline is a GitHub Actions matrix covering all four platform targets using Tauri's built-in cross-compilation and `cross-rs` where needed.

The defining feature of nOffice is deeply embedded local AI across every app. The Rust backend manages a `llama.cpp` server process (HTTP mode, port 8080) running a heavily quantized Qwen3 8B GGUF model (Q4_K_M or Q3_K_S depending on available RAM), and a separate `qwen3-embedding` model instance for document embedding jobs. Every app embeds a shared AI sidebar React component that streams chat responses via Tauri IPC events bridging the llama.cpp SSE stream. The sidebar supports context modes: free chat, edit selection, explain, and generate. The Rust layer (`src-tauri/src/ai/`) handles process lifecycle, model registry scanning (`~/.noffice/models/*.gguf`), a background embedding job queue via `tokio::mpsc`, and an embedded `sled` key-value store for per-document embedding indices. On first launch a model downloader pulls the default Qwen3 8B GGUF from HuggingFace via the `hf_hub` crate with progress events piped to the frontend.

Everything runs fully offline except the optional HuggingFace model download on first launch. No Electron, no cloud dependency, no telemetry.

---

## Commercial Model

- **Pricing:** $8/month or $85/year — single paywall (no free tier)
- **Trial:** 14-day full-feature trial
- **Lifetime license:** None (subscription only)
- **Payment processor:** Lemon Squeezy
- **License enforcement:** Periodic online check with grace period for offline use
- **Source license:** Proprietary (closed source)

---

## Architecture & Stack

### Monorepo

| Aspect | Decision |
|--------|----------|
| Package manager | pnpm 10 |
| Monorepo tool | Turborepo 2.x (latest) |
| Node.js | 20 LTS |
| Package scope | `@noffice/*` |
| Version scheme | CalVer (e.g., 2026.07) |
| App packages | `apps/nwrite`, `apps/nsheet`, `apps/nslides`, `apps/nimg`, `apps/ncode` |
| Shared packages | `packages/ui-core`, `packages/shared`, `packages/configs` |

### Desktop Framework

| Aspect | Decision |
|--------|----------|
| Framework | Tauri 2.x |
| Rust MSRV | 1.81 |
| Async runtime | Tokio |
| Multi-window | Separate Tauri windows per app |
| Window IPC | Tauri events |
| Native menus | Yes — per window, macOS menus in top bar |
| System tray | Minimize to tray on closing last window |
| Auto-update | Tauri built-in updater |

### Frontend

| Aspect | Decision |
|--------|----------|
| Language | TypeScript (strict mode) |
| Lint/format | Biome |
| CSS | Tailwind CSS |
| State management | Zustand |
| Router | TanStack Router |
| UI primitives | Radix UI + Tailwind (shadcn/ui pattern) |
| UI package | `@noffice/ui-core` |
| Storybook | Yes — component catalog for ui-core |
| AI sidebar | Always bundled (not lazy-loaded) |
| Icon set | Lucide icons |
| Bundled font | Inter |

### Rust Backend Layout

Single crate under `src-tauri/src/` with module organization:

- `src-tauri/src/ai/` — model lifecycle, embedding queue, llama.cpp bindings
- `src-tauri/src/lsp-proxy/` — LSP server proxy for nCode
- `src-tauri/src/core/` — shared utilities, config, logging
- `src-tauri/src/commands/` — Tauri command handlers

---

## Launcher & Shell

- **Launcher model:** Like MS Office — app tiles, settings menu, Lemon Squeezy login
- **Launcher layout:** Tile view (large icons, like MS Office launcher)
- **Settings:** Global defaults with per-app overrides
- **First launch:** Interactive walkthrough tutorial
- **Login:** Verifies Lemon Squeezy subscription for commercial license

---

## AI & ML Pipeline

### Model Management

| Aspect | Decision |
|--------|----------|
| Chat model | Qwen3 8B GGUF (Q4_K_M default) |
| Model version | Pull latest from HuggingFace |
| Download | `hf_hub` crate, HuggingFace only (no mirror support) |
| Download UX | Background download with progress bar to frontend |
| Model storage | `~/.noffice/models/*.gguf`, scanned on launch |
| Context window | 32K tokens |
| GPU acceleration | Custom llama.cpp build: Metal + CUDA + ROCm + Vulkan fallback |
| LLaMA integration | Embedded via `llama-cpp-rs` Rust bindings (in-process, not subprocess) |
| Concurrent instances | Chat (8B) + Embedding + SD (3 backends) |

### AI Features

| Aspect | Decision |
|--------|----------|
| Sidebar context modes | Free chat, edit selection, explain, generate, **summarize**, **translate** |
| AI crash handling | Auto-retry 3x, then gracefully degrade (AI unavailable, apps work) |
| Auto-training | Local LoRA adapters trained on-device, no central data collection |

### Embedding Pipeline

| Aspect | Decision |
|--------|----------|
| Embedding model | `qwen3-embedding` instance |
| Embedding DB | Per-document `sled` key-value store |
| Queue | Background `tokio::mpsc` channel |

### Stable Diffusion Backend

| Aspect | Decision |
|--------|----------|
| Primary SD API | Auto1111 REST API (:7860) |
| Alternative SD API | ComfyUI |
| Video gen | Optional Pinokio backend |
| Probe behavior | Rust probes ports on launch, marks features available/greyed-out |
| Model format (SD) | SafeTensors |
| nImg AI features | txt2img + img2img + inpainting + outpainting (all four) |

---

## App Specifications

### nCode (IDE)

| Aspect | Decision |
|--------|----------|
| Editor | Monaco-based, extended as AI-assisted multi-directory coding agent/IDE |
| AI features | Ghost text + inline chat + explain + refactor + generate |
| LSP servers | Bundled: pyright, clangd, rust-analyzer, gopls, solargraph |
| Embedded support | Arduino + Pi Pico (W) — C/C++ + MicroPython |
| File previews | Rich previews (markdown, image, hex) |
| Workspace model | Multi-root (VS Code-style) |
| Theme | Multiple presets (dark, light, monokai, dracula, etc.) |

### nWrite (Word Processor)

| Aspect | Decision |
|--------|----------|
| Editor | TipTap (ProseMirror) |
| Feature set | Full MS Word-level (math, tables, images, comments, track changes, footnotes, etc.) |
| Export | PDF + DOCX + HTML |
| Templates | Yes (resume, letter, report, etc.) |
| AI features | Inline rewrite, summarize, generate via sidebar |
| Spell check | Hunspell (bundled, multi-language) |

### nSheet (Spreadsheet)

| Aspect | Decision |
|--------|----------|
| Formula engine | HyperFormula |
| Grid renderer | Custom WebGL (PixiJS) canvas-based virtualized renderer |
| Cell types | Text + Number + Formula + Date + Boolean |
| Charts | Full suite (bar, line, pie, scatter, area, bubble) — v1 |
| Sheet size limit | 1,048,576 rows × 16,384 columns (Excel standard) |
| AI features | Formula generation + data analysis chat + chart recommendations |

### nSlides (Presentations)

| Aspect | Decision |
|--------|----------|
| Slide model | JSON-based |
| Render engine | Hybrid — SVG (static) + Canvas (transitions/animations) |
| Transitions | Full animations including morph transition |
| Export | PDF + PPTX |
| AI features | Slide generation, speaker note drafting via sidebar |

### nImg (Image Editor)

| Aspect | Decision |
|--------|----------|
| Canvas library | WebGL (PixiJS) |
| Paint tools | Full suite (brush, eraser, shapes, text, fill, eyedropper, airbrush, blur, clone stamp, gradient) |
| Layers | Full layer system with blending modes and opacity |
| Generative AI | txt2img + img2img + inpainting + outpainting via SD backend |

---

## File Formats

| Aspect | Decision |
|--------|----------|
| Primary format | Standard formats (.docx, .xlsx, .pptx, image formats) |
| External import | Google Workspace / M365 import — v1 feature |
| Internal clipboard | Both standard formats + custom Tauri IPC |

---

## System Requirements

| Aspect | Minimum |
|--------|---------|
| RAM | 8 GB |
| Free disk | 8 GB (for models) |
| macOS | 14 Sonoma |
| Windows | 10 22H2 |
| Linux | AppImage (cross-distro) |

---

## Data & Persistence

| Aspect | Decision |
|--------|----------|
| User documents | User chooses on first launch, system Documents folder as default |
| Auto-save | Every 30 seconds with version history (last 10 versions kept locally) |
| App data root | `~/.noffice/` (models, settings, cache) |
| Crash dumps | `~/.noffice/crashes/` — local only, user can share manually |

---

## CI/CD & Build

| Aspect | Decision |
|--------|----------|
| CI provider | GitHub Actions + self-hosted runners for macOS ARM |
| Build matrix | Windows x64, Linux x64, macOS ARM64, macOS x64 |
| Cross-compilation | Both Tauri built-in + cross-rs |
| Code signing | macOS notarization + Windows Authenticode |

### Testing

| Aspect | Decision |
|--------|----------|
| Rust | Unit + integration + property tests (proptest) |
| Frontend | Vitest + Playwright + Storybook tests |
| AI features | Mock llama.cpp HTTP responses in CI |

---

## Accessibility & Internationalization

| Aspect | Decision |
|--------|----------|
| Accessibility | WCAG 2.1 AA |
| i18n infrastructure | Full i18n from day 1 (translate as we go) |

---

## Collaborative Features

| Aspect | Decision |
|--------|----------|
| nWrite collab | Real-time over LAN (no cloud) — v1 |

---

## Security & Privacy

| Aspect | Decision |
|--------|----------|
| Network | Fully offline except model download + license check |
| Telemetry | None |
| Cloud dependency | None |

---

## Release Strategy

- **First public launch:** All five apps together
- **Release cadence:** Daily (continuous/rapid releases)
- **Build order:** (1) Tauri shell + launcher, (2) Rust AI runner, (3) shared AI sidebar, (4) nCode, (5) nWrite, (6) nSheet, (7) nSlides, (8) nImg
