import type { Editor } from "@tiptap/react";
import { Button } from "@noffice/ui-core";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  List,
  ListOrdered,
  Redo,
  Strikethrough,
  Table,
  Underline,
  Undo,
} from "lucide-react";

interface ToolbarProps {
  editor: Editor | null;
  onToggleSidebar: () => void;
}

export function Toolbar({ editor, onToggleSidebar }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-1 border-b border-border px-4 py-2 dark:border-border-dark">
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
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleBold().run()} data-active={editor.isActive("bold")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => {
          const url = window.prompt("Image URL");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}>
          <Image className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table className="h-4 w-4" />
        </Button>
      </div>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
          AI
        </Button>
      </div>
    </div>
  );
}
