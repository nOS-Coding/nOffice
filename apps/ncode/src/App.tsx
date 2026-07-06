import Editor, { type OnMount } from "@monaco-editor/react";
import { AISidebar, Button, useTheme } from "@noffice/ui-core";
import {
  Bot,
  Bug,
  Files,
  FolderOpen,
  GitBranch,
  PanelLeft,
  PanelLeftClose,
  Play,
  Search,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

const DEFAULT_CODE = `// Welcome to nCode - AI-powered IDE
function greet(name: string): string {
  return \`Hello, \${name}! Welcome to nOffice.\`;
}

console.log(greet("Developer"));
`;

const FILE_TREE = [
  {
    name: "src",
    type: "folder",
    children: [
      { name: "index.ts", type: "file" },
      { name: "utils.ts", type: "file" },
    ],
  },
  { name: "package.json", type: "file" },
  { name: "tsconfig.json", type: "file" },
];

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [language, setLanguage] = useState("typescript");
  const [theme] = useState<"vs-dark" | "light">("vs-dark");
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  useTheme();

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-1 dark:border-border-dark">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setShowExplorer(!showExplorer)}>
              {showExplorer ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="icon">
              <Files className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <GitBranch className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm">
              <Play className="mr-1 h-3 w-3" /> Run
            </Button>
            <Button variant="ghost" size="sm">
              <Bug className="mr-1 h-3 w-3" /> Debug
            </Button>
            <div className="mx-2 h-5 w-px bg-border dark:bg-border-dark" />
            <select
              className="rounded bg-transparent text-xs"
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

        <div className="flex flex-1 overflow-hidden">
          {showExplorer && (
            <div className="w-56 overflow-y-auto border-r border-border bg-surface-secondary p-2 text-sm dark:border-border-dark dark:bg-surface-dark-secondary">
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Explorer
              </p>
              {FILE_TREE.map((item) => (
                <div key={item.name}>
                  <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary">
                    <FolderOpen className="h-3.5 w-3.5 text-yellow-500" />
                    <span>{item.name}</span>
                  </div>
                  {item.children?.map((child) => (
                    <div
                      key={child.name}
                      className="ml-4 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                    >
                      <Files className="h-3.5 w-3.5 text-blue-400" />
                      <span>{child.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="flex-1">
            <Editor
              height="100%"
              language={language}
              theme={theme}
              value={DEFAULT_CODE}
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
