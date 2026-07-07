import { AISidebar, useTheme } from "@noffice/ui-core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { FindReplace } from "./components/FindReplace";
import { Toolbar } from "./components/Toolbar";
import { FontSize } from "./extensions/FontSize";
import { Indent } from "./extensions/Indent";
import { LineHeight } from "./extensions/LineHeight";

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const { theme } = useTheme();
  void theme;

  const [pageWidth, setPageWidth] = useState(595);
  const [pageHeight, setPageHeight] = useState(842);
  const [pageMargin, setPageMargin] = useState(40);
  const [showHeader, setShowHeader] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Superscript,
      Subscript,
      Indent,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[500px] px-8 py-4",
        spellcheck: "true",
      },
    },
  });

  const [stats, setStats] = useState({ words: 0, chars: 0, paras: 0 });

  useEffect(() => {
    if (!editor) return;
    const updateStats = () => {
      const text = editor.getText();
      setStats({
        words: text ? text.split(/\s+/).filter(Boolean).length : 0,
        chars: text.length,
        paras: editor.state.doc.childCount,
      });
    };
    updateStats();
    editor.on("update", updateStats);
    return () => {
      editor.off("update", updateStats);
    };
  }, [editor]);

  // Restore from localStorage on mount
  useEffect(() => {
    if (editor) {
      try {
        const saved = localStorage.getItem("nwrite-doc");
        if (saved) {
          editor.commands.setContent(saved);
        }
      } catch (e) {
        console.error("Failed to restore document from localStorage", e);
      }
    }
  }, [editor]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Save to localStorage with 500ms debounce
  useEffect(() => {
    if (editor) {
      const handler = () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try {
            localStorage.setItem("nwrite-doc", editor.getHTML());
          } catch (e) {
            console.error("Failed to save document", e);
          }
        }, 500);
      };
      editor.on("update", handler);
      return () => {
        editor.off("update", handler);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      };
    }
  }, [editor]);

  const saveMessageTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cmd+S / Ctrl+S to save, Cmd+F / Ctrl+F to open find
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editor) {
          try {
            localStorage.setItem("nwrite-doc", editor.getHTML());
          } catch (e) {
            console.error("Failed to save document", e);
          }
        }
        setSavedMessage("Saved");
        if (saveMessageTimerRef.current) clearTimeout(saveMessageTimerRef.current);
        saveMessageTimerRef.current = setTimeout(() => setSavedMessage(""), 2000);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setFindReplaceOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (saveMessageTimerRef.current) clearTimeout(saveMessageTimerRef.current);
    };
  }, [editor]);

  function handlePageSizeChange(width: number, height: number) {
    setPageWidth(width);
    setPageHeight(height);
  }

  const pageStyle: React.CSSProperties = {
    width: `${pageWidth}px`,
    minHeight: `${pageHeight}px`,
    margin: "0 auto",
    padding: `${pageMargin}px`,
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
    position: "relative",
  };

  return (
    <div className="flex h-screen" style={{ background: "#ffffff" }}>
      <style>{`
        .ProseMirror,
        .ProseMirror p {
          background: #ffffff !important;
          color: #000000 !important;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af !important;
        }
      `}</style>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Toolbar
          editor={editor}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleFind={() => setFindReplaceOpen((prev) => !prev)}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          pageMargin={pageMargin}
          showHeader={showHeader}
          showFooter={showFooter}
          onPageSizeChange={handlePageSizeChange}
          setPageMargin={setPageMargin}
          setShowHeader={setShowHeader}
          setShowFooter={setShowFooter}
        />
        <div className="relative flex-1 overflow-y-auto" style={{ background: "#e8e8e8" }}>
          {findReplaceOpen && (
            <FindReplace editor={editor} onClose={() => setFindReplaceOpen(false)} />
          )}
          <div className="flex justify-center py-8">
            <div style={pageStyle}>
              {showHeader && (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="mb-4 border-b pb-2 text-sm text-gray-500"
                  onInput={(e) => setHeaderText((e.target as HTMLElement).textContent ?? "")}
                >
                  {headerText || "Header"}
                </div>
              )}
              <EditorContent editor={editor} />
              {showFooter && (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="mt-4 border-t pt-2 text-sm text-gray-500"
                  onInput={(e) => setFooterText((e.target as HTMLElement).textContent ?? "")}
                >
                  {footerText || "Footer"}
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-4 border-t px-4 py-1 text-xs text-gray-500"
          style={{ background: "#f8f9fa" }}
        >
          <span>Words: {stats.words}</span>
          <span>Characters: {stats.chars}</span>
          <span>Paragraphs: {stats.paras}</span>
        </div>
      </div>
      {savedMessage && (
        <div className="fixed bottom-4 right-4 rounded bg-green-500 px-3 py-1 text-sm text-white shadow-lg">
          {savedMessage}
        </div>
      )}
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nWrite Document"
      />
    </div>
  );
}
