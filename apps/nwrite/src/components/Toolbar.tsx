import { Button } from "@noffice/ui-core";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTree,
  Minus,
  PanelBottom,
  PanelTop,
  Quote,
  Redo,
  RemoveFormatting,
  Search,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { exportDocx } from "../extensions/exportDocx";

interface ToolbarProps {
  editor: Editor | null;
  onToggleSidebar: () => void;
  onToggleFind: () => void;
  pageWidth: number;
  pageHeight: number;
  pageMargin: number;
  showHeader: boolean;
  showFooter: boolean;
  onPageSizeChange: (width: number, height: number) => void;
  setPageMargin: (margin: number) => void;
  setShowHeader: (show: boolean) => void;
  setShowFooter: (show: boolean) => void;
}

const FONT_OPTIONS = [
  "Inter",
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Impact",
];

const INDENT_LEVELS = ["0em", "2em", "4em", "6em"];

const PAGE_PRESETS = [
  { label: "A4", width: 595, height: 842 },
  { label: "Letter", width: 612, height: 792 },
  { label: "Legal", width: 612, height: 1008 },
] as const;

const MARGIN_PRESETS = [
  { label: "Normal", value: 40 },
  { label: "Narrow", value: 20 },
  { label: "Wide", value: 60 },
] as const;

export function Toolbar({
  editor,
  onToggleSidebar,
  onToggleFind,
  pageWidth,
  pageHeight,
  pageMargin,
  showHeader,
  showFooter,
  onPageSizeChange,
  setPageMargin,
  setShowHeader,
  setShowFooter,
}: ToolbarProps) {
  const [fontSize, setFontSize] = useState(() => {
    try {
      return localStorage.getItem("nwrite-font-size") || "16";
    } catch {
      return "16";
    }
  });
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkEdit, setShowLinkEdit] = useState(false);
  const linkEditRef = useRef<HTMLDivElement>(null);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const attrs = editor.getAttributes("fontSize");
      if (attrs.fontSize) {
        setFontSize(attrs.fontSize.replace("px", ""));
      }
      if (editor.isActive("link")) {
        const linkAttrs = editor.getAttributes("link");
        if (linkAttrs.href) {
          setLinkUrl(linkAttrs.href as string);
        }
      }
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  useEffect(() => {
    if (!showLinkEdit) return;
    const handler = (e: MouseEvent) => {
      if (linkEditRef.current && !linkEditRef.current.contains(e.target as Node)) {
        setShowLinkEdit(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showLinkEdit]);

  if (!editor) return null;

  function tb(condition: boolean): Record<string, string> {
    return condition ? { "data-active": "true" } : {};
  }

  function getCurrentIndent(): string {
    if (!editor) return "0em";
    const attrs = editor.getAttributes("indent");
    return (attrs.indent as string) || "0em";
  }

  function handleIndent() {
    if (!editor) return;
    const current = getCurrentIndent();
    const idx = INDENT_LEVELS.indexOf(current);
    const next = idx < INDENT_LEVELS.length - 1 ? idx + 1 : idx;
    if (next === 0) {
      editor.chain().focus().unsetIndent().run();
    } else {
      const level = INDENT_LEVELS[next];
      if (level) {
        editor.chain().focus().setIndent(level).run();
      }
    }
  }

  function handleOutdent() {
    if (!editor) return;
    const current = getCurrentIndent();
    const idx = INDENT_LEVELS.indexOf(current);
    const prev = idx > 0 ? idx - 1 : 0;
    if (prev === 0) {
      editor.chain().focus().unsetIndent().run();
    } else {
      const level = INDENT_LEVELS[prev];
      if (level) {
        editor.chain().focus().setIndent(level).run();
      }
    }
  }

  function handleExportPDF() {
    window.print();
    setExportOpen(false);
  }

  function handleExportHTML() {
    if (!editor) return;
    const html = editor.getHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.html";
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function handleExportTXT() {
    if (!editor) return;
    const text = editor.getText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.txt";
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function handleExportDOCX() {
    if (!editor) return;
    exportDocx(editor.getHTML());
    setExportOpen(false);
  }

  function handleImageClick() {
    imageInputRef.current?.click();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result as string })
        .run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleLinkClick() {
    if (!editor) return;
    if (editor.isActive("link")) {
      setShowLinkEdit(true);
    } else {
      const url = window.prompt("Link URL");
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function handleLinkSave() {
    if (!editor) return;
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setShowLinkEdit(false);
  }

  function handleLinkRemove() {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setShowLinkEdit(false);
    setLinkUrl("");
  }

  function handleOrientationChange() {
    if (orientation === "portrait") {
      setOrientation("landscape");
      onPageSizeChange(pageHeight, pageWidth);
    } else {
      setOrientation("portrait");
      onPageSizeChange(pageHeight, pageWidth);
    }
  }

  const sinkListItem = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().sinkListItem("listItem").run();
  }, [editor]);

  const liftListItem = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().liftListItem("listItem").run();
  }, [editor]);

  return (
    <div
      className="flex items-center gap-1 border-b border-border px-4 py-2 dark:border-border-dark"
      style={{ background: "#f8f9fa" }}
    >
      <style>{`
        button[data-active="true"] {
          background: #e9ecef !important;
          color: #4c6ef5 !important;
        }
        select {
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          padding: 0 4px;
          height: 28px;
          font-size: 12px;
        }
      `}</style>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBold().run()}
          {...tb(editor.isActive("bold"))}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          {...tb(editor.isActive("italic"))}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          {...tb(editor.isActive("underline"))}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          {...tb(editor.isActive("strike"))}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          {...tb(editor.isActive("highlight"))}
        >
          <Highlighter className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          {...tb(editor.isActive("superscript"))}
        >
          <Superscript className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          {...tb(editor.isActive("subscript"))}
        >
          <Subscript className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          {...tb(editor.isActive("heading", { level: 1 }))}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          {...tb(editor.isActive("heading", { level: 2 }))}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          {...tb(editor.isActive("heading", { level: 3 }))}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          {...tb(editor.isActive({ textAlign: "left" }))}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          {...tb(editor.isActive({ textAlign: "center" }))}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          {...tb(editor.isActive({ textAlign: "right" }))}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          {...tb(editor.isActive("bulletList"))}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          {...tb(editor.isActive("orderedList"))}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={sinkListItem}
          disabled={!editor.can().sinkListItem("listItem")}
          title="Indent list item"
        >
          <ListTree className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={liftListItem}
          disabled={!editor.can().liftListItem("listItem")}
          title="Outdent list item"
        >
          <IndentIncrease className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={handleImageClick}>
          <Image className="h-4 w-4" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table className="h-4 w-4" />
        </Button>
        {editor.isActive("table") && (
          <>
            <div className="mx-1 text-[10px] text-gray-400">|</div>
            <button
              type="button"
              className="rounded px-1 text-[10px] hover:bg-gray-200"
              onClick={() => editor.chain().focus().addRowBefore().run()}
              title="Add Row Before"
            >
              R↑
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] hover:bg-gray-200"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              title="Add Row After"
            >
              R↓
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] hover:bg-gray-200"
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              title="Add Column Before"
            >
              C←
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] hover:bg-gray-200"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              title="Add Column After"
            >
              C→
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] text-red-600 hover:bg-red-100"
              onClick={() => editor.chain().focus().deleteRow().run()}
              title="Delete Row"
            >
              DelR
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] text-red-600 hover:bg-red-100"
              onClick={() => editor.chain().focus().deleteColumn().run()}
              title="Delete Column"
            >
              DelC
            </button>
            <button
              type="button"
              className="rounded px-1 text-[10px] text-red-600 hover:bg-red-100"
              onClick={() => editor.chain().focus().deleteTable().run()}
              title="Delete Table"
            >
              DelT
            </button>
          </>
        )}
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleCode().run()}
          {...tb(editor.isActive("code"))}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          {...tb(editor.isActive("blockquote"))}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLinkClick}
            {...tb(editor.isActive("link"))}
          >
            <Link className="h-4 w-4" />
          </Button>
          {showLinkEdit && (
            <div
              ref={linkEditRef}
              className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-white p-3 shadow-lg dark:border-border-dark dark:bg-gray-800"
            >
              <div className="mb-2 text-xs font-medium">Edit Link</div>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="mb-2 w-full rounded border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={handleLinkSave}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="flex-1" onClick={handleLinkRemove}>
                  Remove
                </Button>
              </div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          {...tb(editor.isActive("taskList"))}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleIndent}
          {...tb(getCurrentIndent() !== "0em")}
          title="Increase indent"
        >
          <IndentIncrease className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOutdent}
          disabled={getCurrentIndent() === "0em"}
          title="Decrease indent"
        >
          <IndentIncrease className="h-4 w-4 -scale-x-100 transform" />
        </Button>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <select
          value={fontSize}
          onChange={(e) => {
            const size = e.target.value;
            setFontSize(size);
            editor
              .chain()
              .focus()
              .setMark("fontSize", { fontSize: `${size}px` })
              .run();
            try {
              localStorage.setItem("nwrite-font-size", size);
            } catch (e) {
              console.error("Failed to save font size preference", e);
            }
          }}
        >
          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <select
          defaultValue=""
          onChange={(e) => {
            const family = e.target.value;
            if (family) {
              editor.chain().focus().setFontFamily(family).run();
            }
          }}
          title="Font family"
        >
          <option value="" disabled>
            Font
          </option>
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <input
          type="color"
          className="h-7 w-7 cursor-pointer rounded border border-border p-0.5"
          defaultValue="#000000"
          onChange={(e) => {
            editor.chain().focus().setColor(e.target.value).run();
          }}
          title="Text color"
        />
        <input
          type="color"
          className="h-7 w-7 cursor-pointer rounded border border-border p-0.5"
          defaultValue="#ffff00"
          onChange={(e) => {
            editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
          }}
          title="Highlight color"
        />
        <select
          defaultValue="1.5"
          onChange={(e) => {
            editor.chain().focus().setMark("lineHeight", { lineHeight: e.target.value }).run();
          }}
          title="Line spacing"
        >
          <option value="1">1</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2</option>
          <option value="2.5">2.5</option>
          <option value="3">3</option>
        </select>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <select
          value={
            PAGE_PRESETS.find((p) => p.width === pageWidth && p.height === pageHeight)?.label ??
            `${pageWidth}x${pageHeight}`
          }
          onChange={(e) => {
            const preset = PAGE_PRESETS.find((p) => p.label === e.target.value);
            if (preset) {
              onPageSizeChange(preset.width, preset.height);
            }
          }}
          title="Page size"
        >
          {PAGE_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOrientationChange}
          title="Toggle orientation"
          className="text-xs"
        >
          {orientation === "portrait" ? "Portr" : "Land"}
        </Button>
        <select
          value={pageMargin}
          onChange={(e) => {
            setPageMargin(Number(e.target.value));
          }}
          title="Margins"
        >
          {MARGIN_PRESETS.map((m) => (
            <option key={m.label} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHeader(!showHeader)}
          {...tb(showHeader)}
          title="Toggle header"
        >
          <PanelTop className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowFooter(!showFooter)}
          {...tb(showFooter)}
          title="Toggle footer"
        >
          <PanelBottom className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-gray-400">1</span>
      </div>
      <div className="mx-1 h-5 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onToggleFind}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <div className="relative" ref={exportRef}>
          <Button variant="ghost" size="sm" onClick={() => setExportOpen(!exportOpen)}>
            Export
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-white py-1 shadow-lg dark:border-border-dark dark:bg-gray-800">
              <button
                type="button"
                className="flex w-full px-4 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleExportPDF}
              >
                Export as PDF
              </button>
              <button
                type="button"
                className="flex w-full px-4 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleExportHTML}
              >
                Export as HTML
              </button>
              <button
                type="button"
                className="flex w-full px-4 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleExportTXT}
              >
                Export as TXT
              </button>
              <button
                type="button"
                className="flex w-full px-4 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleExportDOCX}
              >
                Export as DOCX
              </button>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
          AI
        </Button>
      </div>
    </div>
  );
}
