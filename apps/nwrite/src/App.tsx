import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AISidebar, useTheme } from "@noffice/ui-core";
import { useState } from "react";
import { Toolbar } from "./components/Toolbar";

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTheme();

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
    ],
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[500px] px-8 py-4",
      },
    },
  });

  return (
    <div className="flex h-screen">
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
        <Toolbar editor={editor} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex-1 overflow-y-auto bg-surface-secondary dark:bg-surface-dark-secondary">
          <div className="mx-auto max-w-4xl bg-white">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <AISidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        appContext="nWrite Document"
      />
    </div>
  );
}
