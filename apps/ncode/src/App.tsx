import Editor, { type OnMount } from "@monaco-editor/react";
import { AISidebar, Button, useTheme } from "@noffice/ui-core";
import {
  Bot,
  Bug,
  FileCode,
  FilePlus,
  Files,
  Folder,
  FolderOpen,
  PanelLeft,
  PanelLeftClose,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import type { ThemeOption } from "@noffice/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_CODE = `// Welcome to nCode - AI-powered IDE
function greet(name: string): string {
  return \`Hello, \${name}! Welcome to nOffice.\`;
}

console.log(greet("Developer"));
`;

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

function createInitialTree(): FileNode[] {
  return [
    {
      name: "src",
      type: "folder",
      children: [
        { name: "index.ts", type: "file", content: DEFAULT_CODE, language: "typescript" },
        { name: "utils.ts", type: "file", content: "// Utility functions\n\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n", language: "typescript" },
      ],
    },
    { name: "index.html", type: "file", content: "<html><body><script src=\"src/index.ts\"></script></body></html>", language: "html" },
    { name: "README.md", type: "file", content: "# nCode Project\n\nEdit and run your code here.", language: "markdown" },
  ];
}

function flattenFiles(nodes: FileNode[], path = ""): { path: string; node: FileNode }[] {
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

const langExtMap: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rs: "rust", cpp: "cpp", c: "cpp", h: "cpp",
  go: "go", json: "json", html: "html", css: "css", md: "markdown",
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
  const monacoTheme: "vs-dark" | "light" = useMemo(() => {
    if (appTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "vs-dark" : "light";
    }
    const darkThemes: ThemeOption[] = ["dark", "midnight", "forest", "ocean"];
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
  const [searchResults, setSearchResults] = useState<{ path: string; line: string; lineNum: number }[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [showOutput, setShowOutput] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.setTheme(monacoTheme);
    editor.focus();
  }, []);

  const allFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => {
          if (prev) {
            setSearchQuery("");
            setSearchResults([]);
          }
          return !prev;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function openFile(path: string) {
    const found = allFiles.find((f) => f.path === path);
    if (found && found.node.type === "file") {
      setCode(found.node.content || "");
      setFileName(found.node.name);
      setLanguage(found.node.language || extToLang(found.node.name));
      setActiveFilePath(path);
    }
  }

  function saveFile() {
    const content = editorRef.current?.getValue() || code;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function loadFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setFileName(file.name);
      setLanguage(extToLang(file.name));
      const text = await file.text();
      setCode(text);
    };
    input.click();
  }

  function runCode() {
    const content = editorRef.current?.getValue() || code;
    setOutput((prev) => [...prev, `> Running ${fileName}...`]);
    setShowOutput(true);
    try {
      if (language === "javascript" || language === "typescript") {
        const logs: string[] = [];
        const mockConsole = { log: (...args: unknown[]) => logs.push(args.map(String).join(" ")) };
        const fn = new Function("console", content);
        fn(mockConsole);
        setOutput((prev) => [...prev, ...logs, "> Done (no errors)"]);
      } else {
        setOutput((prev) => [...prev, `> Cannot run ${language} files in browser. Save and run externally.`]);
      }
    } catch (err) {
      setOutput((prev) => [...prev, `> Error: ${err}`]);
    }
    setOutput((prev) => [...prev, ""]);
  }

  function debugCode() {
    setOutput((prev) => [...prev, `> Debug mode for ${fileName}`, "> Set breakpoints in code using `debugger;`", "> Open browser DevTools (F12) for full debugging", ""]);
    setShowOutput(true);
    try {
      if (language === "javascript" || language === "typescript") {
        const content = editorRef.current?.getValue() || code;
        const fn = new Function("console", `debugger;\n${content}`);
        const logs: string[] = [];
        const mockConsole = { log: (...args: unknown[]) => logs.push(args.map(String).join(" ")) };
        fn(mockConsole);
        setOutput((prev) => [...prev, ...logs, "> Debug session ended"]);
      }
    } catch (err) {
      setOutput((prev) => [...prev, `> Debug error: ${err}`]);
    }
    setOutput((prev) => [...prev, ""]);
  }

  function deleteFile(path: string) {
    const parts = path.split("/");
    const targetName = parts[parts.length - 1];
    if (!targetName) return;
    setFileTree((prev) => {
      function removeFrom(nodes: FileNode[], depth: number): FileNode[] {
        return nodes.reduce<FileNode[]>((acc, n) => {
          const nameAtDepth = parts[depth];
          if (n.type === "file" && n.name === targetName && n.name === nameAtDepth) {
            return acc;
          }
          if (n.children && n.name === nameAtDepth) {
            const newChildren = removeFrom(n.children, depth + 1);
            return [...acc, { ...n, children: newChildren }];
          }
          return [...acc, n];
        }, []);
      }
      return removeFrom(prev, 0);
    });
    if (activeFilePath === path) {
      const remaining = allFiles.filter((f) => f.path !== path);
      if (remaining.length > 0) {
        openFile(remaining[0]!.path);
      }
    }
  }

  function createNewFile() {
    const name = window.prompt("File name:", "untitled.ts");
    if (!name) return;
    if (fileTree.some((n) => n.name === name)) {
      window.alert(`A file or folder named "${name}" already exists.`);
      return;
    }
    const lang = extToLang(name);
    const newNode: FileNode = { name, type: "file", content: "", language: lang };
    setFileTree((prev) => [...prev, newNode]);
    setCode("");
    setFileName(name);
    setLanguage(lang);
    setActiveFilePath(name);
  }

  function createFileInFolder(folderPath: string) {
    const name = window.prompt("File name:", "untitled.ts");
    if (!name) return;

    function hasDuplicate(nodes: FileNode[], parts: string[], depth: number): boolean {
      for (const n of nodes) {
        if (n.type === "folder" && n.name === parts[depth]) {
          if (depth === parts.length - 1) {
            return n.children?.some((c) => c.name === name) ?? false;
          }
          if (n.children) return hasDuplicate(n.children, parts, depth + 1);
        }
      }
      return false;
    }

    if (hasDuplicate(fileTree, folderPath.split("/"), 0)) {
      window.alert(`A file named "${name}" already exists in this folder.`);
      return;
    }

    const lang = extToLang(name);
    const newNode: FileNode = { name, type: "file", content: "", language: lang };

    setFileTree((prev) => {
      function addTo(nodes: FileNode[], parts: string[], depth: number): FileNode[] {
        return nodes.map((n) => {
          if (n.type === "folder" && n.name === parts[depth] && depth === parts.length - 1) {
            return { ...n, children: [...(n.children || []), newNode] };
          }
          if (n.children && n.name === parts[depth]) {
            return { ...n, children: addTo(n.children, parts, depth + 1) };
          }
          return n;
        });
      }
      return addTo(prev, folderPath.split("/"), 0);
    });

    const fullPath = `${folderPath}/${name}`;
    setCode("");
    setFileName(name);
    setLanguage(lang);
    setActiveFilePath(fullPath);
  }

  function updateFileContent(path: string, content: string) {
    const parts = path.split("/");
    const targetName = parts[parts.length - 1];
    if (!targetName) return;
    setFileTree((prev) => {
      function updateIn(nodes: FileNode[], depth: number): FileNode[] {
        return nodes.map((n) => {
          const nameAtDepth = parts[depth];
          if (n.type === "file" && n.name === targetName && n.name === nameAtDepth) {
            return { ...n, content };
          }
          if (n.children && n.name === nameAtDepth) {
            return { ...n, children: updateIn(n.children, depth + 1) };
          }
          return n;
        });
      }
      return updateIn(prev, 0);
    });
  }

  function doSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const results: { path: string; line: string; lineNum: number }[] = [];
    const lowerQuery = query.toLowerCase();
    for (const { path, node } of allFiles) {
      if (node.content) {
        const lines = node.content.split("\n");
        lines.forEach((line, i) => {
          if (line.toLowerCase().includes(lowerQuery)) {
            results.push({ path, line: line.trim(), lineNum: i + 1 });
          }
        });
      }
    }
    setSearchResults(results);
  }

  function renderTree(nodes: FileNode[], depth = 0, parentPath = "") {
    return nodes.map((node) => {
      const paddingLeft = depth * 16 + 8;
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.type === "folder") {
        return (
          <div key={node.name}>
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
              style={{ paddingLeft }}
            >
              <Folder className="h-3.5 w-3.5 text-yellow-500" />
              <span className="flex-1 font-medium text-gray-700 dark:text-gray-300">{node.name}</span>
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
            {node.children && renderTree(node.children, depth + 1, currentPath)}
          </div>
        );
      }
      const isActive = allFiles.find((f) => f.path === activeFilePath)?.node === node;
      return (
        <div
          key={node.name}
          className={`group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary ${
            isActive ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-gray-600 dark:text-gray-400"
          }`}
          style={{ paddingLeft }}
          onClick={() => openFile(currentPath)}
        >
          <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span className="truncate flex-1">{node.name}</span>
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
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-1 dark:border-border-dark">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowExplorer(!showExplorer)}>
              {showExplorer ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={loadFile}>
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={createNewFile}>
              <FilePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={saveFile}>
              <Files className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setShowSearch(!showSearch); setSearchQuery(""); setSearchResults([]); }}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={runCode}>
              <Play className="mr-1 h-3 w-3" /> Run
            </Button>
            <Button variant="ghost" size="sm" onClick={debugCode}>
              <Bug className="mr-1 h-3 w-3" /> Debug
            </Button>
            <div className="mx-2 h-5 w-px bg-border dark:bg-border-dark" />
            <span className="text-xs text-gray-500">{fileName}</span>
            <select
              className="rounded bg-transparent text-xs ml-2"
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
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Bot className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showSearch && (
          <div className="border-b border-border bg-surface-secondary px-4 py-2 dark:border-border-dark dark:bg-surface-dark-secondary">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
                placeholder="Search across all files..."
                value={searchQuery}
                onChange={(e) => doSearch(e.target.value)}
                autoFocus
              />
              <span className="text-xs text-gray-400">{searchResults.length} results</span>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded border border-border bg-surface dark:border-border-dark dark:bg-surface-dark">
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex cursor-pointer gap-2 px-3 py-1.5 text-xs hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                    onClick={() => {
                      openFile(r.path);
                      setTimeout(() => {
                        const editor = editorRef.current;
                        if (!editor || !searchQuery) return;
                        const model = editor.getModel();
                        if (!model) return;
                        const matches = model.findMatches(searchQuery, false, true, false, null, true);
                        const first = matches[0];
                        if (first) {
                          editor.setSelection(first.range);
                          editor.revealRangeInCenter(first.range);
                        }
                      }, 50);
                    }}
                  >
                    <span className="shrink-0 text-brand-500">{r.path}:{r.lineNum}</span>
                    <span className="truncate text-gray-600 dark:text-gray-400">{r.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                  setCode(v || "");
                  if (activeFilePath) updateFileContent(activeFilePath, v || "");
                }}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  renderWhitespace: "selection",
                  tabSize: 2,
                  wordWrap: "off",
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
                  <span className="text-xs font-medium text-gray-400">Output</span>
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
      </div>
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nCode IDE"
      />
    </div>
  );
}
