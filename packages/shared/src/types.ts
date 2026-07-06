export enum AppId {
  Launcher = "noffice",
  NWrite = "nwrite",
  NSheet = "nsheet",
  NSlides = "nslides",
  NImg = "nimg",
  NCode = "ncode",
}

export interface AppDefinition {
  id: AppId;
  name: string;
  description: string;
  icon: string;
  color: string;
  windowLabel: string;
}

export interface AIContextMode {
  id: "free_chat" | "edit_selection" | "explain" | "generate" | "summarize" | "translate";
  label: string;
  icon: string;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export interface AIProgressEvent {
  stage: "downloading" | "loading" | "ready" | "error";
  progress: number;
  message: string;
}

export interface EmbeddingJob {
  id: string;
  documentId: string;
  text: string;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface DocumentIndex {
  version: number;
  chunks: EmbeddingChunk[];
  metadata: Record<string, string>;
}

export interface EmbeddingChunk {
  id: string;
  text: string;
  vector: Float64Array | number[];
  position: number;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  fontSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  language: string;
  modelPath: string;
  modelQuantization: string;
  aiEnabled: boolean;
}

export interface WindowConfig {
  label: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  url: string;
}

export interface LSServerConfig {
  language: string;
  command: string;
  args: string[];
  extensions: string[];
}

export const APPS: Record<AppId, AppDefinition> = {
  [AppId.Launcher]: {
    id: AppId.Launcher,
    name: "nOffice",
    description: "Launch apps and manage settings",
    icon: "grid",
    color: "#4c6ef5",
    windowLabel: "noffice",
  },
  [AppId.NWrite]: {
    id: AppId.NWrite,
    name: "nWrite",
    description: "Word processor",
    icon: "file-text",
    color: "#2b8a3e",
    windowLabel: "nwrite",
  },
  [AppId.NSheet]: {
    id: AppId.NSheet,
    name: "nSheet",
    description: "Spreadsheet",
    icon: "table",
    color: "#e67700",
    windowLabel: "nsheet",
  },
  [AppId.NSlides]: {
    id: AppId.NSlides,
    name: "nSlides",
    description: "Presentations",
    icon: "presentation",
    color: "#cc5de8",
    windowLabel: "nslides",
  },
  [AppId.NImg]: {
    id: AppId.NImg,
    name: "nImg",
    description: "Image editor",
    icon: "image",
    color: "#d6336c",
    windowLabel: "nimg",
  },
  [AppId.NCode]: {
    id: AppId.NCode,
    name: "nCode",
    description: "Code editor",
    icon: "code",
    color: "#1971c2",
    windowLabel: "ncode",
  },
};

export const AI_CONTEXT_MODES: AIContextMode[] = [
  { id: "free_chat", label: "Free Chat", icon: "message-circle" },
  { id: "edit_selection", label: "Edit Selection", icon: "pencil" },
  { id: "explain", label: "Explain", icon: "help-circle" },
  { id: "generate", label: "Generate", icon: "sparkles" },
  { id: "summarize", label: "Summarize", icon: "file-text" },
  { id: "translate", label: "Translate", icon: "globe" },
];

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  fontSize: 14,
  autoSave: true,
  autoSaveInterval: 30,
  language: "en",
  modelPath: "~/.noffice/models/qwen3-8b-q4_k_m.gguf",
  modelQuantization: "Q4_K_M",
  aiEnabled: true,
};

export const AI_MODEL_INFO = {
  chat: {
    name: "Qwen3 8B",
    quantization: "Q4_K_M",
    contextWindow: 32768,
    gpuBackends: ["Metal", "CUDA", "ROCm", "Vulkan"],
  },
  embedding: {
    name: "qwen3-embedding",
    dimension: 4096,
  },
};

export const APP_WINDOWS: Record<AppId, WindowConfig> = {
  [AppId.Launcher]: { label: "noffice", title: "nOffice", width: 900, height: 650, url: "/" },
  [AppId.NWrite]: { label: "nwrite", title: "nWrite", width: 1280, height: 900, minWidth: 800, minHeight: 600, url: "/" },
  [AppId.NSheet]: { label: "nsheet", title: "nSheet", width: 1400, height: 900, minWidth: 900, minHeight: 600, url: "/" },
  [AppId.NSlides]: { label: "nslides", title: "nSlides", width: 1280, height: 800, minWidth: 800, minHeight: 600, url: "/" },
  [AppId.NImg]: { label: "nimg", title: "nImg", width: 1280, height: 900, minWidth: 800, minHeight: 600, url: "/" },
  [AppId.NCode]: { label: "ncode", title: "nCode", width: 1400, height: 950, minWidth: 900, minHeight: 600, url: "/" },
};

export const LSP_SERVERS: LSServerConfig[] = [
  { language: "python", command: "pyright-langserver", args: ["--stdio"], extensions: [".py"] },
  { language: "cpp", command: "clangd", args: [], extensions: [".cpp", ".c", ".h", ".hpp"] },
  { language: "rust", command: "rust-analyzer", args: [], extensions: [".rs"] },
  { language: "go", command: "gopls", args: [], extensions: [".go"] },
  { language: "ruby", command: "solargraph", args: ["stdio"], extensions: [".rb"] },
];

export const FILE_FORMATS = {
  nwrite: [".docx", ".odt", ".html", ".md", ".txt", ".rtf"],
  nsheet: [".xlsx", ".ods", ".csv", ".tsv"],
  nslides: [".pptx", ".odp", ".pdf"],
  nimg: [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".tiff"],
  ncode: ["*"],
};
