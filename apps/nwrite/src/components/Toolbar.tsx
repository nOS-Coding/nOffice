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
  onToggleSidebar: () => void;
}

export function Toolbar({ onToggleSidebar }: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-4 py-2 dark:border-border-dark">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Underline className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Strikethrough className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Heading3 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <AlignRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div className="mx-2 h-6 w-px bg-border dark:bg-border-dark" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Image className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
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
