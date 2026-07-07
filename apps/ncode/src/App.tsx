import Editor, { type OnMount } from "@monaco-editor/react";
import { AISidebar, Button, useTheme } from "@noffice/ui-core";
import type { ThemeOption } from "@noffice/shared";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  Bot,
  Bug,
  Copy,
  FileCode,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Minimize2,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Play,
  Save,
  Search,
  Settings,
  Trash2,
  WrapText,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CODE = `// Welcome to nCode - AI-powered IDE
function greet(name: string): string {
  return \`Hello, \${name}! Welcome to nOffice.\`;
}

console.log(greet("Developer"));
`;

const MAX_TABS = 20;

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

interface TabData {
  path: string;
  name: string;
  code: string;
  language: string;
  modified: boolean;
}

interface ContextMenuData {
  x: number;
  y: number;
  path: string;
  targetType: "file" | "folder";
}

interface CursorPosition {
  line: number;
  column: number;
}

interface Command {
  id: string;
  label: string;
  action: () => void;
}

interface SettingsState {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showMinimap: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: false,
  showMinimap: true,
};

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem("ncode-settings");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsState>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

function persistSettings(s: SettingsState) {
  try {
    localStorage.setItem("ncode-settings", JSON.stringify(s));
  } catch {
    // ignore
  }
}

function createInitialTree(): FileNode[] {
  return [
    {
      name: "src",
      type: "folder",
      children: [
        {
          name: "index.ts",
          type: "file",
          content: DEFAULT_CODE,
          language: "typescript",
        },
        {
          name: "utils.ts",
          type: "file",
          content:
            "// Utility functions\n\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n",
          language: "typescript",
        },
      ],
    },
    {
      name: "index.html",
      type: "file",
      content:
        "<html><body><script src=\"src/index.ts\"></script></body></html>",
      language: "html",
    },
    {
      name: "README.md",
      type: "file",
      content: "# nCode Project\n\nEdit and run your code here.",
      language: "markdown",
    },
  ];
}

function flattenFiles(
  nodes: FileNode[],
  path = "",
): { path: string; node: FileNode }[] {
  const result: { path: string; node: FileNode }[] = [];
  for (const node of nodes) {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    if (node.type === "file") {
      result.push({ path: fullPath, node });
    }
    if (node.children) {
      result.push(...flattenFiles(node.children, fullPath));
    }
  }
  return result;
}

function getNewFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return `${name}-copy`;
  const base = name.slice(0, dot);
  const ext = name.slice(dot);
  return `${base}-copy${ext}`;
}

const langExtMap: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  rs: "rust",
  go: "go",
  java: "java",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  c: "c",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  cs: "csharp",
  fs: "fsharp",
  scala: "scala",
  r: "r",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  jsonc: "json",
  xml: "xml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  md: "markdown",
  txt: "plaintext",
};

function extToLang(name: string): string {
  const ext = name.split(".").pop() || "";
  return langExtMap[ext] || "plaintext";
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [language, setLanguage] = useState("typescript");
  const { theme: appTheme } = useTheme();

  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monacoTheme: "vs-dark" | "light" = useMemo(() => {
    if (appTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "vs-dark"
        : "light";
    }
    const darkThemes: ThemeOption[] = [
      "dark",
      "midnight",
      "forest",
      "ocean",
    ];
    return darkThemes.includes(appTheme) ? "vs-dark" : "light";
  }, [appTheme]);

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(monacoTheme);
    }
  }, [monacoTheme]);

  const [code, setCode] = useState(DEFAULT_CODE);
  const [fileName, setFileName] = useState("index.ts");
  const [fileTree, setFileTree] = useState<FileNode[]>(() => createInitialTree());
  const [activeFilePath, setActiveFilePath] = useState("src/index.ts");
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { path: string; line: string; lineNum: number }[]
  >([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(
    null,
  );
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    line: 1,
    column: 1,
  });

  // Tab state
  const [openTabs, setOpenTabs] = useState<TabData[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  // Modified files tracking
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());

  // Word Wrap (separate toggle for quick access)
  const [wordWrap, setWordWrap] = useState(() => loadSettings().wordWrap);

  // Minimap
  const [showMinimap, setShowMinimap] = useState(
    () => loadSettings().showMinimap,
  );

  // Command palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");

  const allFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  // Apply settings to editor when they change
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        wordWrap: wordWrap ? "on" : "off",
        minimap: { enabled: showMinimap },
      });
    }
    persistSettings(settings);
  }, [settings, wordWrap, showMinimap]);

  const openFile = useCallback(
    (path: string) => {
      const found = allFiles.find((f) => f.path === path);
      if (!found || found.node.type !== "file") return;

      // Check if tab already exists
      const existingTabIndex = openTabs.findIndex((t) => t.path === path);

      if (existingTabIndex >= 0) {
        // Switch to existing tab
        const existingTab = openTabs[existingTabIndex];
        if (existingTab) {
          setCode(existingTab.code);
          setFileName(existingTab.name);
          setLanguage(existingTab.language);
          setActiveFilePath(path);
          setActiveTabPath(path);
        }
      } else {
        // Create new tab
        const content = found.node.content || "";
        const newTab: TabData = {
          path,
          name: found.node.name,
          code: content,
          language: found.node.language || extToLang(found.node.name),
          modified: modifiedFiles.has(path),
        };

        setOpenTabs((prev) => {
          const next = [newTab, ...prev.filter((t) => t.path !== path)];
          if (next.length > MAX_TABS) {
            // LRU eviction: remove last tab if not active
            const last = next[next.length - 1];
            if (last && last.path !== path) {
              next.pop();
            }
          }
          return next;
        });

        setCode(content);
        setFileName(found.node.name);
        setLanguage(newTab.language);
        setActiveFilePath(path);
        setActiveTabPath(path);
      }
    },
    [allFiles, openTabs, modifiedFiles],
  );

  // Editor mount
  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      monaco.editor.setTheme(monacoTheme);
      editor.onDidChangeCursorPosition((e) => {
        setCursorPosition({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      });
      editor.focus();
    },
    [monacoTheme],
  );

  // Tab switching handler
  const switchToTab = useCallback(
    (path: string) => {
      if (path === activeTabPath) return;

      // Sync current tab's code before switching
      const editorContent = editorRef.current?.getValue() ?? code;
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTabPath ? { ...t, code: editorContent } : t,
        ),
      );

      // Load new tab
      const tab = openTabs.find((t) => t.path === path);
      if (tab) {
        setCode(tab.code);
        setFileName(tab.name);
        setLanguage(tab.language);
        setActiveFilePath(path);
        setActiveTabPath(path);

        // Move to front for LRU
        setOpenTabs((prev) => {
          const without = prev.filter((t) => t.path !== path);
          return [tab, ...without];
        });
      }
    },
    [activeTabPath, code, openTabs],
  );

  // Close tab
  const closeTab = useCallback(
    (path: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setOpenTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        return next;
      });

      if (activeTabPath === path) {
        const remaining = openTabs.filter((t) => t.path !== path);
        if (remaining.length > 0) {
          const first = remaining[0];
          if (first) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => switchToTab(first.path), 0);
          }
        } else {
          setActiveFilePath("");
          setActiveTabPath(null);
          setCode("");
          setFileName("untitled");
          setLanguage("plaintext");
        }
      }
    },
    [activeTabPath, openTabs, switchToTab],
  );

  // Update content (called on editor change and for replace operations)
  const updateContent = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (activeFilePath) {
        updateFileContent(activeFilePath, newCode);
        setModifiedFiles((prev) => {
          const next = new Set(prev);
          next.add(activeFilePath);
          return next;
        });
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.path === activeTabPath
              ? { ...t, code: newCode, modified: true }
              : t,
          ),
        );
      }
    },
    [activeFilePath, activeTabPath],
  );

  // Save file
  const saveFile = useCallback(async () => {
    const content = editorRef.current?.getValue() || code;
    const currentName =
      openTabs.find((t) => t.path === activeTabPath)?.name || fileName;

    try {
      const filePath = await save({
        defaultPath: currentName,
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, content);
        // Mark as unmodified
        if (activeTabPath) {
          setModifiedFiles((prev) => {
            const next = new Set(prev);
            next.delete(activeTabPath);
            return next;
          });
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.path === activeTabPath
                ? { ...t, modified: false }
                : t,
            ),
          );
          updateFileContent(activeTabPath, content);
        }
      }
    } catch {
      // Fallback to browser download
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [code, fileName, openTabs, activeTabPath]);

  // Load file
  function loadFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const path = file.name;
      setFileName(file.name);
      setLanguage(extToLang(file.name));

      // Open in tab
      const newTab: TabData = {
        path,
        name: file.name,
        code: text,
        language: extToLang(file.name),
        modified: false,
      };
      setOpenTabs((prev) => {
        const next = [newTab, ...prev.filter((t) => t.path !== path)];
        if (next.length > MAX_TABS) next.pop();
        return next;
      });
      setCode(text);
      setActiveFilePath(path);
      setActiveTabPath(path);
    };
    input.click();
  }

  // Run code
  function runCode() {
    const content = editorRef.current?.getValue() || code;
    setOutput((prev) => [...prev, `> Running ${fileName}...`]);
    setShowOutput(true);
    try {
      if (language === "javascript" || language === "typescript") {
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: unknown[]) =>
            logs.push(args.map(String).join(" ")),
        };
        const fn = new Function("console", content);
        fn(mockConsole);
        setOutput((prev) => [
          ...prev,
          ...logs,
          "> Done (no errors)",
        ]);
      } else {
        setOutput((prev) => [
          ...prev,
          `> Cannot run ${language} files in browser. Save and run externally.`,
        ]);
      }
    } catch (err) {
      setOutput((prev) => [...prev, `> Error: ${err}`]);
    }
    setOutput((prev) => [...prev, ""]);
  }

  // Debug code
  function debugCode() {
    setOutput((prev) => [
      ...prev,
      `> Debug mode for ${fileName}`,
      "> Set breakpoints in code using `debugger;`",
      "> Open browser DevTools (F12) for full debugging",
      "",
    ]);
    setShowOutput(true);
    try {
      if (language === "javascript" || language === "typescript") {
        const content = editorRef.current?.getValue() || code;
        const fn = new Function("console", `debugger;\n${content}`);
        const logs: string[] = [];
        const mockConsole = {
          log: (...args: unknown[]) =>
            logs.push(args.map(String).join(" ")),
        };
        fn(mockConsole);
        setOutput((prev) => [
          ...prev,
          ...logs,
          "> Debug session ended",
        ]);
      }
    } catch (err) {
      setOutput((prev) => [...prev, `> Debug error: ${err}`]);
    }
    setOutput((prev) => [...prev, ""]);
  }

  // Delete file
  function deleteFile(path: string) {
    const parts = path.split("/");
    const targetName = parts[parts.length - 1];
    if (!targetName) return;

    setFileTree((prev) => {
      function removeFrom(
        nodes: FileNode[],
        depth: number,
      ): FileNode[] {
        return nodes.reduce<FileNode[]>((acc, n) => {
          const nameAtDepth = parts[depth];
          if (
            n.type === "file" &&
            n.name === targetName &&
            n.name === nameAtDepth
          ) {
            return acc;
          }
          if (n.children && n.name === nameAtDepth) {
            const newChildren = removeFrom(n.children, depth + 1);
            return [...acc, { ...n, children: newChildren }];
          }
          if (n.type === "folder" && n.name === nameAtDepth && depth === parts.length - 1) {
            return acc;
          }
          return [...acc, n];
        }, []);
      }
      return removeFrom(prev, 0);
    });

    // Close tab if open
    setOpenTabs((prev) => prev.filter((t) => t.path !== path));
    setModifiedFiles((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });

    if (activeTabPath === path) {
      const remaining = allFiles.filter((f) => f.path !== path);
      if (remaining.length > 0) {
        const first = remaining[0];
        if (first) openFile(first.path);
      } else {
        setActiveFilePath("");
        setActiveTabPath(null);
        setCode("");
        setFileName("untitled");
      }
    }
  }

  // Create new file at root
  function createNewFile() {
    const name = window.prompt("File name:", "untitled.ts");
    if (!name) return;
    if (fileTree.some((n) => n.name === name)) {
      window.alert(`A file or folder named "${name}" already exists.`);
      return;
    }
    const lang = extToLang(name);
    const newNode: FileNode = {
      name,
      type: "file",
      content: "",
      language: lang,
    };
    setFileTree((prev) => [...prev, newNode]);
    const newTab: TabData = {
      path: name,
      name,
      code: "",
      language: lang,
      modified: false,
    };
    setOpenTabs((prev) => [newTab, ...prev].slice(0, MAX_TABS));
    setCode("");
    setFileName(name);
    setLanguage(lang);
    setActiveFilePath(name);
    setActiveTabPath(name);
  }

  // Create file in folder
  function createFileInFolder(folderPath: string) {
    const name = window.prompt("File name:", "untitled.ts");
    if (!name) return;

    function hasDuplicate(
      nodes: FileNode[],
      parts: string[],
      depth: number,
    ): boolean {
      for (const n of nodes) {
        if (n.type === "folder" && n.name === parts[depth]) {
          if (depth === parts.length - 1) {
            return n.children?.some((c) => c.name === name) ?? false;
          }
          if (n.children)
            return hasDuplicate(n.children, parts, depth + 1);
        }
      }
      return false;
    }

    if (hasDuplicate(fileTree, folderPath.split("/"), 0)) {
      window.alert(
        `A file named "${name}" already exists in this folder.`,
      );
      return;
    }

    const lang = extToLang(name);
    const newNode: FileNode = {
      name,
      type: "file",
      content: "",
      language: lang,
    };

    setFileTree((prev) => {
      function addTo(
        nodes: FileNode[],
        parts: string[],
        depth: number,
      ): FileNode[] {
        return nodes.map((n) => {
          if (
            n.type === "folder" &&
            n.name === parts[depth] &&
            depth === parts.length - 1
          ) {
            return {
              ...n,
              children: [...(n.children || []), newNode],
            };
          }
          if (n.children && n.name === parts[depth]) {
            return {
              ...n,
              children: addTo(n.children, parts, depth + 1),
            };
          }
          return n;
        });
      }
      return addTo(prev, folderPath.split("/"), 0);
    });

    const fullPath = `${folderPath}/${name}`;
    const newTab: TabData = {
      path: fullPath,
      name,
      code: "",
      language: lang,
      modified: false,
    };
    setOpenTabs((prev) => [newTab, ...prev].slice(0, MAX_TABS));
    setCode("");
    setFileName(name);
    setLanguage(lang);
    setActiveFilePath(fullPath);
    setActiveTabPath(fullPath);
  }

  // Update file content in tree
  function updateFileContent(path: string, content: string) {
    const parts = path.split("/");
    const targetName = parts[parts.length - 1];
    if (!targetName) return;
    setFileTree((prev) => {
      function updateIn(
        nodes: FileNode[],
        depth: number,
      ): FileNode[] {
        return nodes.map((n) => {
          const nameAtDepth = parts[depth];
          if (
            n.type === "file" &&
            n.name === targetName &&
            n.name === nameAtDepth
          ) {
            return { ...n, content };
          }
          if (n.children && n.name === nameAtDepth) {
            return {
              ...n,
              children: updateIn(n.children, depth + 1),
            };
          }
          return n;
        });
      }
      return updateIn(prev, 0);
    });
  }

  // Rename file
  function startRename(path: string) {
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    if (!name) return;
    setRenamingPath(path);
    setRenamingValue(name);
  }

  function confirmRename() {
    if (!renamingPath || !renamingValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const parts = renamingPath.split("/");
    const oldName = parts[parts.length - 1];
    if (!oldName) {
      setRenamingPath(null);
      return;
    }

    const newName = renamingValue.trim();
    const parentPath =
      parts.length > 1
        ? parts.slice(0, -1).join("/")
        : "";
    const newPath = parentPath
      ? `${parentPath}/${newName}`
      : newName;

    // Update tree
    setFileTree((prev) => {
      function renameIn(
        nodes: FileNode[],
        depth: number,
      ): FileNode[] {
        return nodes.map((n) => {
          const nameAtDepth = parts[depth];
          if (depth === parts.length - 1 && n.name === nameAtDepth) {
            return { ...n, name: newName };
          }
          if (n.children && n.name === nameAtDepth) {
            return {
              ...n,
              children: renameIn(n.children, depth + 1),
            };
          }
          return n;
        });
      }
      return renameIn(prev, 0);
    });

    // Update tabs
    setOpenTabs((prev) =>
      prev.map((t) =>
        t.path === renamingPath
          ? { ...t, path: newPath, name: newName }
          : t,
      ),
    );

    // Update modified files
    setModifiedFiles((prev) => {
      const next = new Set(prev);
      if (prev.has(renamingPath)) {
        next.delete(renamingPath);
        next.add(newPath);
      }
      return next;
    });

    // Update active file path
    if (activeFilePath === renamingPath) {
      setActiveFilePath(newPath);
      setFileName(newName);
    }

    if (activeTabPath === renamingPath) {
      setActiveTabPath(newPath);
    }

    setRenamingPath(null);
  }

  // Duplicate file
  function duplicateFile(path: string) {
    const found = allFiles.find((f) => f.path === path);
    if (!found) return;

    const parts = path.split("/");
    const oldName = parts[parts.length - 1];
    if (!oldName) return;

    const newName = getNewFileName(oldName);
    const parentPath =
      parts.length > 1
        ? parts.slice(0, -1).join("/")
        : "";

    const newNode: FileNode = {
      name: newName,
      type: "file",
      content: found.node.content,
      language: found.node.language || extToLang(newName),
    };

    if (parentPath) {
      setFileTree((prev) => {
        function addTo(
          nodes: FileNode[],
          p: string[],
          depth: number,
        ): FileNode[] {
          return nodes.map((n) => {
            const nameAtDepth = p[depth];
            if (
              n.type === "folder" &&
              n.name === nameAtDepth &&
              depth === p.length - 1
            ) {
              return {
                ...n,
                children: [...(n.children || []), newNode],
              };
            }
            if (n.children && n.name === nameAtDepth) {
              return {
                ...n,
                children: addTo(n.children, p, depth + 1),
              };
            }
            return n;
          });
        }
        return addTo(prev, parentPath.split("/"), 0);
      });
    } else {
      setFileTree((prev) => [...prev, newNode]);
    }
  }

  // Create folder via context menu
  function createFolder(parentPath: string) {
    const name = window.prompt("Folder name:", "new-folder");
    if (!name) return;

    const newNode: FileNode = {
      name,
      type: "folder",
      children: [],
    };

    if (parentPath) {
      setFileTree((prev) => {
        function addTo(
          nodes: FileNode[],
          parts: string[],
          depth: number,
        ): FileNode[] {
          return nodes.map((n) => {
            const nameAtDepth = parts[depth];
            if (
              n.type === "folder" &&
              n.name === nameAtDepth &&
              depth === parts.length - 1
            ) {
              return {
                ...n,
                children: [...(n.children || []), newNode],
              };
            }
            if (n.children && n.name === nameAtDepth) {
              return {
                ...n,
                children: addTo(n.children, parts, depth + 1),
              };
            }
            return n;
          });
        }
        return addTo(prev, parentPath.split("/"), 0);
      });
    } else {
      setFileTree((prev) => [...prev, newNode]);
    }
  }

  // Search
  const performSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      searchTimerRef.current = setTimeout(() => {
        const results: {
          path: string;
          line: string;
          lineNum: number;
        }[] = [];
        const lowerQuery = query.toLowerCase();
        for (const { path, node } of allFiles) {
          if (node.content) {
            const lines = node.content.split("\n");
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(lowerQuery)) {
                results.push({
                  path,
                  line: line.trim(),
                  lineNum: i + 1,
                });
              }
            });
          }
        }
        setSearchResults(results);
        setSelectedResultIndex(null);
      }, 300);
    },
    [allFiles],
  );

  // Replace single match (currently selected or first)
  function replaceCurrentMatch() {
    if (!searchQuery || selectedResultIndex === null) return;
    const result = searchResults[selectedResultIndex];
    if (!result) return;

    openFile(result.path);
    setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const matches = model.findMatches(
        searchQuery,
        false,
        true,
        false,
        null,
        true,
      );
      const matchIndex = matches.findIndex(
        (m) =>
          m.range.startLineNumber === result.lineNum &&
          model
            .getLineContent(result.lineNum)
            .includes(searchQuery),
      );
      const targetIndex =
        matchIndex >= 0 ? matchIndex : 0;
      const match = matches[targetIndex];
      if (!match) return;

      editor.executeEdits("replace", [
        {
          range: match.range,
          text: replaceQuery,
          forceMoveMarkers: true,
        },
      ]);

      // Update stored content
      const newContent = editor.getValue();
      updateContent(newContent);

      // Refresh search results
      performSearch(searchQuery);
    }, 50);
  }

  // Replace all matches
  function replaceAllMatches() {
    if (!searchQuery) return;

    function replaceInContent(content: string): string {
      return content.replaceAll(searchQuery, replaceQuery);
    }

    setFileTree((prev) => {
      function replaceInTree(nodes: FileNode[]): FileNode[] {
        return nodes.map((n) => {
          if (n.type === "file" && n.content) {
            return {
              ...n,
              content: replaceInContent(n.content),
            };
          }
          if (n.children) {
            return {
              ...n,
              children: replaceInTree(n.children),
            };
          }
          return n;
        });
      }
      return replaceInTree(prev);
    });

    // Update open tabs
    setOpenTabs((prev) =>
      prev.map((t) => ({
        ...t,
        code: t.code.includes(searchQuery)
          ? t.code.replaceAll(searchQuery, replaceQuery)
          : t.code,
        modified: t.code.includes(searchQuery) ? true : t.modified,
      })),
    );

    // Update current editor if it was affected
    const activeTab = openTabs.find(
      (t) => t.path === activeTabPath,
    );
    if (activeTab && activeTab.code.includes(searchQuery)) {
      const newCode = activeTab.code.replaceAll(
        searchQuery,
        replaceQuery,
      );
      setCode(newCode);
      setModifiedFiles((prev) => {
        const next = new Set(prev);
        if (activeTabPath) next.add(activeTabPath);
        return next;
      });
    }

    // Refresh search
    performSearch(searchQuery);
  }

  // Context menu handlers
  function handleContextMenu(
    e: React.MouseEvent,
    path: string,
    targetType: "file" | "folder",
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, targetType });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  // Dismiss context menu on outside click and Escape
  useEffect(() => {
    function handleClick() {
      closeContextMenu();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeContextMenu();
        setShowCommandPalette(false);
        setShowSettings(false);
        setRenamingPath(null);
      }
    }
    if (contextMenu) {
      window.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleKey);
    }
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  // Keyboard shortcuts (persistent)
  const saveFileRef = useRef<() => Promise<void>>(async () => {});
  saveFileRef.current = saveFile;

  const closeContextMenuRef = useRef(() => {});
  closeContextMenuRef.current = closeContextMenu;

  const startRenameRef = useRef((_path: string) => {});
  startRenameRef.current = startRename;

  const activeTabPathRef = useRef<string | null>(null);
  activeTabPathRef.current = activeTabPath;

  const fileNameRef = useRef("");
  fileNameRef.current = fileName;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFileRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => {
          if (prev) {
            setSearchQuery("");
            setSearchResults([]);
          }
          return !prev;
        });
        return;
      }
      if (e.key === "F2" && activeTabPathRef.current) {
        e.preventDefault();
        startRenameRef.current(activeTabPathRef.current);
        return;
      }
      if (e.key === "Escape") {
        closeContextMenuRef.current();
        setShowCommandPalette(false);
        setShowSettings(false);
        setRenamingPath(null);
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Command palette actions
  const commands: Command[] = useMemo(
    () => [
      {
        id: "new-file",
        label: "New File",
        action: () => {
          createNewFile();
          setShowCommandPalette(false);
        },
      },
      {
        id: "save",
        label: "Save",
        action: () => {
          saveFile();
          setShowCommandPalette(false);
        },
      },
      {
        id: "run-code",
        label: "Run Code",
        action: () => {
          runCode();
          setShowCommandPalette(false);
        },
      },
      {
        id: "toggle-word-wrap",
        label: "Toggle Word Wrap",
        action: () => {
          setWordWrap((prev) => !prev);
          setShowCommandPalette(false);
        },
      },
      {
        id: "change-language",
        label: "Change Language",
        action: () => {
          setShowCommandPalette(false);
          document.querySelector<HTMLSelectElement>(".lang-select")?.focus();
        },
      },
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        action: () => {
          setShowExplorer((prev) => !prev);
          setShowCommandPalette(false);
        },
      },
      {
        id: "toggle-minimap",
        label: "Toggle Minimap",
        action: () => {
          setShowMinimap((prev) => !prev);
          setShowCommandPalette(false);
        },
      },
      {
        id: "toggle-output",
        label: "Toggle Output Panel",
        action: () => {
          setShowOutput((prev) => !prev);
          setShowCommandPalette(false);
        },
      },
    ],
    [],
  );

  const filteredCommands = useMemo(
    () =>
      commands.filter((c) =>
        c.label.toLowerCase().includes(commandFilter.toLowerCase()),
      ),
    [commands, commandFilter],
  );

  function executeCommand(cmd: Command) {
    cmd.action();
    setCommandFilter("");
  }

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    if (!activeTabPath) return [];
    const parts = activeTabPath.split("/");
    const crumbs: { label: string; path: string }[] = [];
    let current = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      current = current ? `${current}/${part}` : part;
      crumbs.push({ label: part, path: current });
    }
    return crumbs;
  }, [activeTabPath]);

  // Indentation display
  const indentDisplay = `Spaces: ${settings.tabSize}`;

  // Render tree nodes
  function renderTree(
    nodes: FileNode[],
    depth = 0,
    parentPath = "",
  ) {
    return nodes.map((node) => {
      const paddingLeft = depth * 16 + 8;
      const currentPath = parentPath
        ? `${parentPath}/${node.name}`
        : node.name;
      const isModified =
        node.type === "file" && modifiedFiles.has(currentPath);

      if (node.type === "folder") {
        return (
          <div key={currentPath}>
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
              style={{ paddingLeft }}
              onContextMenu={(e) =>
                handleContextMenu(e, currentPath, "folder")
              }
            >
              <Folder className="h-3.5 w-3.5 text-yellow-500" />
              <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">
                {node.name}
              </span>
              <button
                className="shrink-0 rounded p-0.5 text-gray-400 hover:text-brand-500"
                title={`New file in ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  createFileInFolder(currentPath);
                }}
              >
                <FilePlus className="h-3 w-3" />
              </button>
            </div>
            {node.children &&
              renderTree(node.children, depth + 1, currentPath)}
          </div>
        );
      }

      const isActive =
        allFiles.find((f) => f.path === activeFilePath)?.node ===
        node;

      return (
        <div
          key={currentPath}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary ${
            isActive
              ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
              : "text-gray-600 dark:text-gray-400"
          }`}
          style={{ paddingLeft }}
          onClick={() => openFile(currentPath)}
          onContextMenu={(e) =>
            handleContextMenu(e, currentPath, "file")
          }
        >
          {isModified && (
            <span className="absolute left-1 h-2 w-2 rounded-full bg-green-500" />
          )}
          <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          {renamingPath === currentPath ? (
            <input
              className="flex-1 rounded border border-brand-500 bg-surface px-1 py-0.5 text-xs outline-none dark:bg-surface-dark"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmRename();
                if (e.key === "Escape") setRenamingPath(null);
              }}
              onBlur={confirmRename}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate flex-1">{node.name}</span>
          )}
          <button
            className="hidden shrink-0 rounded p-0.5 text-gray-400 hover:text-brand-500 group-hover:block"
            title="Rename"
            onClick={(e) => {
              e.stopPropagation();
              startRename(currentPath);
            }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="hidden shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500 group-hover:block"
            onClick={(e) => {
              e.stopPropagation();
              deleteFile(currentPath);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );
    });
  }

  return (
    <div className="relative flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-1 dark:border-border-dark">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExplorer(!showExplorer)}
            >
              {showExplorer ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={loadFile}>
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={createNewFile}>
              <FilePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={saveFile}>
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowSearch(!showSearch);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setWordWrap((p) => !p)}
              title={`Word Wrap: ${wordWrap ? "ON" : "OFF"}`}
            >
              <WrapText
                className={`h-4 w-4 ${
                  wordWrap ? "text-brand-500" : ""
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowMinimap((p) => !p)}
              title={`Minimap: ${showMinimap ? "ON" : "OFF"}`}
            >
              <Minimize2
                className={`h-4 w-4 ${
                  !showMinimap ? "text-brand-500" : ""
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              title="Settings (Cmd+,)"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCommandPalette(true)}
              title="Command Palette (Cmd+Shift+P)"
            >
              <Search className="h-4 w-4 opacity-50" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
            <span className="text-xs text-gray-500">
              <GitBranch className="mr-1 inline h-3 w-3" />
              {modifiedFiles.size > 0
                ? `${modifiedFiles.size} modified`
                : "no changes"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={runCode}>
              <Play className="mr-1 h-3 w-3" /> Run
            </Button>
            <Button variant="ghost" size="sm" onClick={debugCode}>
              <Bug className="mr-1 h-3 w-3" /> Debug
            </Button>
            <div className="mx-2 h-5 w-px bg-border dark:bg-border-dark" />
            <select
              className="lang-select rounded bg-transparent text-xs"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="rust">Rust</option>
              <option value="cpp">C++</option>
              <option value="go">Go</option>
            </select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search & Replace */}
        {showSearch && (
          <div className="border-b border-border bg-surface-secondary px-4 py-2 dark:border-border-dark dark:bg-surface-dark-secondary">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
                placeholder="Search across all files..."
                value={searchQuery}
                onChange={(e) => performSearch(e.target.value)}
                autoFocus
              />
              <input
                className="w-40 rounded border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
              />
              <button
                className="rounded bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
                disabled={!searchQuery || !replaceQuery}
                onClick={replaceAllMatches}
              >
                Replace All
              </button>
              <button
                className="rounded bg-surface-tertiary px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50 dark:bg-surface-dark-tertiary"
                disabled={
                  !searchQuery ||
                  !replaceQuery ||
                  selectedResultIndex === null
                }
                onClick={replaceCurrentMatch}
              >
                Replace
              </button>
              <span className="text-xs text-gray-400">
                {searchResults.length} results
              </span>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex cursor-pointer gap-2 px-3 py-1.5 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary ${
                      selectedResultIndex === i
                        ? "bg-brand-50 dark:bg-brand-900/20"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedResultIndex(i);
                      openFile(r.path);
                      setTimeout(() => {
                        const editor = editorRef.current;
                        if (!editor || !searchQuery) return;
                        const model = editor.getModel();
                        if (!model) return;
                        const matches = model.findMatches(
                          searchQuery,
                          false,
                          true,
                          false,
                          null,
                          true,
                        );
                        const first = matches[0];
                        if (first) {
                          editor.setSelection(first.range);
                          editor.revealRangeInCenter(first.range);
                        }
                      }, 50);
                    }}
                  >
                    <span className="shrink-0 text-brand-500">
                      {r.path}:{r.lineNum}
                    </span>
                    <span className="truncate text-gray-600 dark:text-gray-400">
                      {r.line}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 border-b border-border bg-surface-secondary px-3 py-1 text-xs text-gray-500 dark:border-border-dark dark:bg-surface-dark-secondary">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="text-gray-400">&rsaquo;</span>
                )}
                <span
                  className={`cursor-pointer rounded px-1 py-0.5 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary ${
                    i === breadcrumb.length - 1
                      ? "font-medium text-gray-700 dark:text-gray-200"
                      : ""
                  }`}
                  onClick={() => openFile(crumb.path)}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Tab Bar */}
        {openTabs.length > 0 && (
          <div className="flex items-center border-b border-border bg-surface-secondary dark:border-border-dark dark:bg-surface-dark-secondary">
            <div className="flex flex-1 overflow-x-auto">
              {openTabs.map((tab) => {
                const isActive = tab.path === activeTabPath;
                return (
                  <div
                    key={tab.path}
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-tertiary dark:border-border-dark dark:hover:bg-surface-dark-tertiary ${
                      isActive
                        ? "border-b-2 border-b-brand-500 bg-surface text-gray-900 dark:bg-surface-dark dark:text-white"
                        : "text-gray-500"
                    }`}
                    onClick={() => switchToTab(tab.path)}
                  >
                    {tab.modified && (
                      <span className="h-2 w-2 rounded-full bg-blue-400" />
                    )}
                    <span className="truncate max-w-28">
                      {tab.name}
                    </span>
                    <button
                      className="ml-1 rounded p-0.5 text-gray-400 hover:bg-surface-tertiary hover:text-gray-600 dark:hover:bg-surface-dark-tertiary dark:hover:text-gray-300"
                      onClick={(e) => closeTab(tab.path, e)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {showExplorer && (
            <div className="w-56 overflow-y-auto border-r border-border bg-surface-secondary p-2 text-sm dark:border-border-dark dark:bg-surface-dark-secondary">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Explorer
              </p>
              {renderTree(fileTree)}
            </div>
          )}
          <div className="flex flex-1 flex-col">
            <div className="flex-1">
              <Editor
                height="100%"
                language={language}
                theme={monacoTheme}
                value={code}
                onChange={(v) => {
                  const newCode = v || "";
                  updateContent(newCode);
                }}
                onMount={handleEditorMount}
                options={{
                  fontSize: settings.fontSize,
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: showMinimap },
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  tabSize: settings.tabSize,
                  wordWrap: wordWrap ? "on" : "off",
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  bracketPairColorization: { enabled: true },
                  autoIndent: "full",
                  formatOnPaste: true,
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  padding: { top: 8 },
                }}
              />
            </div>
            {showOutput && (
              <div className="h-40 border-t border-border bg-surface-dark dark:border-border-dark">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-medium text-gray-400">
                    Output
                  </span>
                  <button
                    className="text-xs text-gray-500 hover:text-white"
                    onClick={() => setShowOutput(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="h-[calc(100%-28px)] overflow-y-auto px-3 font-mono text-xs text-gray-300">
                  {output.map((line, i) => (
                    <div key={i}>{line || <br />}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between border-t border-border bg-surface-secondary px-4 py-1 text-xs text-gray-500 dark:border-border-dark dark:bg-surface-dark-secondary">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {activeTabPath || "No file open"}
            </span>
            <span>
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>{language}</span>
            <span>UTF-8</span>
            <span>{indentDisplay}</span>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-36 rounded-lg border border-border bg-surface py-1 shadow-lg dark:border-border-dark dark:bg-surface-dark"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.targetType === "folder" && (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  createFileInFolder(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <FilePlus className="h-3.5 w-3.5" />
                New File
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  createFolder(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </button>
              <div className="my-1 border-t border-border dark:border-border-dark" />
            </>
          )}
          {contextMenu.targetType === "file" && (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  startRename(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  duplicateFile(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </button>
              <div className="my-1 border-t border-border dark:border-border-dark" />
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  deleteFile(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}
          {contextMenu.targetType === "folder" && (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  startRename(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Rename
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                onClick={() => {
                  deleteFile(contextMenu.path);
                  closeContextMenu();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          onClick={() => {
            setShowCommandPalette(false);
            setCommandFilter("");
          }}
        >
          <div
            className="w-96 rounded-lg border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center border-b border-border px-3 dark:border-border-dark">
              <Search className="mr-2 h-4 w-4 text-gray-400" />
              <input
                className="flex-1 bg-transparent py-3 text-sm outline-none dark:text-white"
                placeholder="Type a command..."
                value={commandFilter}
                onChange={(e) => setCommandFilter(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowCommandPalette(false);
                    setCommandFilter("");
                  }
                  if (e.key === "Enter") {
                    const first = filteredCommands[0];
                    if (first) {
                      executeCommand(first);
                    }
                  }
                }}
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  className="flex w-full items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-surface-tertiary dark:text-gray-300 dark:hover:bg-surface-dark-tertiary"
                  onClick={() => executeCommand(cmd)}
                >
                  {cmd.label}
                </button>
              ))}
              {filteredCommands.length === 0 && (
                <div className="px-4 py-3 text-xs text-gray-400">
                  No commands found
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => {
            setShowSettings(false);
          }}
        >
          <div
            className="w-96 rounded-lg border border-border bg-surface p-6 shadow-2xl dark:border-border-dark dark:bg-surface-dark"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Settings
              </h2>
              <button
                className="rounded p-1 text-gray-400 hover:bg-surface-tertiary hover:text-gray-600 dark:hover:bg-surface-dark-tertiary"
                onClick={() => setShowSettings(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Font Size */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Font Size: {settings.fontSize}
                </label>
                <input
                  type="range"
                  min={10}
                  max={32}
                  value={settings.fontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((prev) => ({ ...prev, fontSize: v }));
                  }}
                  className="w-full"
                />
              </div>

              {/* Tab Size */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Tab Size
                </label>
                <div className="flex gap-2">
                  {[2, 4, 8].map((size) => (
                    <button
                      key={size}
                      className={`rounded px-3 py-1 text-xs ${
                        settings.tabSize === size
                          ? "bg-brand-500 text-white"
                          : "bg-surface-tertiary text-gray-600 hover:bg-surface dark:bg-surface-dark-tertiary dark:text-gray-400"
                      }`}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          tabSize: size,
                        }))
                      }
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Word Wrap */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Word Wrap
                </span>
                <button
                  className={`rounded px-3 py-1 text-xs ${
                    wordWrap
                      ? "bg-brand-500 text-white"
                      : "bg-surface-tertiary text-gray-600 dark:bg-surface-dark-tertiary dark:text-gray-400"
                  }`}
                  onClick={() => setWordWrap((prev) => !prev)}
                >
                  {wordWrap ? "ON" : "OFF"}
                </button>
              </div>

              {/* Minimap */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Minimap
                </span>
                <button
                  className={`rounded px-3 py-1 text-xs ${
                    showMinimap
                      ? "bg-brand-500 text-white"
                      : "bg-surface-tertiary text-gray-600 dark:bg-surface-dark-tertiary dark:text-gray-400"
                  }`}
                  onClick={() => setShowMinimap((prev) => !prev)}
                >
                  {showMinimap ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nCode IDE"
      />
    </div>
  );
}
