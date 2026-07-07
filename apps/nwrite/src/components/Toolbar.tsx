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
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  RemoveFormatting,
  Search,
  Strikethrough,
  Table,
  Underline,
  Undo,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ToolbarProps {
  editor: Editor | null;
  onToggleSidebar: () => void;
  onToggleFind: () => void;
}

export function Toolbar({ editor, onToggleSidebar, onToggleFind }: ToolbarProps) {
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

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const attrs = editor.getAttributes("fontSize");
      if (attrs.fontSize) {
        setFontSize(attrs.fontSize.replace("px", ""));
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

  if (!editor) return null;

  function tb(condition: boolean): Record<string, string> {
    return condition ? { "data-active": "true" } : {};
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
      `}</style>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()}>
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          {...tb(editor.isActive("link"))}
        >
          <Link className="h-4 w-4" />
        </Button>
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
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onToggleFind}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <select
          className="h-8 rounded border border-border bg-white px-1 text-xs dark:border-border-dark dark:bg-gray-800"
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
        <input
          type="color"
          className="h-7 w-7 cursor-pointer rounded border border-border p-0.5"
          defaultValue="#000000"
          onChange={(e) => {
            editor.chain().focus().setColor(e.target.value).run();
          }}
          title="Text color"
        />
        <select
          className="h-8 rounded border border-border bg-white px-1 text-xs dark:border-border-dark dark:bg-gray-800"
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
      <div className="ml-auto flex items-center gap-1">
        <div className="relative" ref={exportRef}>
          <Button variant="ghost" size="sm" onClick={() => setExportOpen(!exportOpen)}>
            Export
          </Button>
          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-white py-1 shadow-lg dark:border-border-dark dark:bg-gray-800">
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
