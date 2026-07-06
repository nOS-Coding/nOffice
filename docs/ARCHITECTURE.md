# nOffice Architecture

## Overview

nOffice is a cross-platform desktop office suite built with Tauri 2.x. It consists of five applications launched from a single shell, with deeply embedded local AI across every app.

## Directory Structure

```
noffice/
├── apps/
│   ├── noffice/          # Launcher shell
│   ├── nwrite/           # Word processor (TipTap/ProseMirror)
│   ├── nsheet/           # Spreadsheet (HyperFormula + PixiJS)
│   ├── nslides/          # Presentations (SVG + Canvas)
│   ├── nimg/             # Image editor (PixiJS)
│   └── ncode/            # IDE (Monaco Editor)
├── packages/
│   ├── ui-core/          # Design system (React + Radix + Tailwind)
│   ├── shared/           # Shared types, constants, utilities
│   └── configs/          # Shared configs (TS, Tailwind, Biome)
├── src-tauri/
│   └── src/
│       ├── ai/           # Model lifecycle, embedding, llama.cpp
│       ├── lsp-proxy/    # LSP server proxy for nCode
│       ├── core/         # Config, logging, utilities
│       └── commands/     # Tauri IPC command handlers
└── docs/
```

## Key Design Decisions

1. **Tauri Multi-Window**: Each app spawns as its own Tauri window via the launcher, sharing the same Rust backend process.

2. **Local AI Stack**: llama.cpp runs in-process via `llama-cpp-2` Rust bindings. Chat (8B) + Embedding models run concurrently. Stable Diffusion connects via external REST API.

3. **AI sidebar**: Shared React component in `ui-core` that connects to llama.cpp SSE stream via Tauri IPC events. Supports 6 context modes.

4. **State Management**: Zustand for frontend state. Rust manages AI process lifecycle, embedding queue (tokio::mpsc), and sled KV store for document indices.

5. **Offline-First**: Fully offline except model download (HuggingFace) and license check (Lemon Squeezy). No telemetry.

## IPC Flow

```
Frontend (React)
  → Tauri invoke("ai_start_stream", {prompt, modeId, streamId})
    → Rust AI Manager
      → llama.cpp inference (in-process)
        → Tauri emit("ai:stream:{streamId}", chunk)
          → Frontend listens via listen("ai:stream:{streamId}")
```

## Data Flow

```
~/.noffice/
├── config.json          # User settings
├── models/*.gguf        # Downloaded GGUF models
├── embeddings/          # Sled KV store for document embeddings
├── logs/                # Application logs
└── crashes/             # Crash dumps (local only)
```

## Build Order

1. Tauri shell + launcher
2. Rust AI runner (llama.cpp integration)
3. Shared AI sidebar component
4. nCode (IDE)
5. nWrite (Word Processor)
6. nSheet (Spreadsheet)
7. nSlides (Presentations)
8. nImg (Image Editor)
