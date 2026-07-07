import { Button } from "@noffice/ui-core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface FindReplaceProps {
  editor: Editor | null;
  onClose: () => void;
}

function findAllMatches(doc: Editor["state"]["doc"], searchTerm: string) {
  const matches: { from: number; to: number }[] = [];
  if (!searchTerm || !doc) return matches;
  doc.descendants((node, pos) => {
    if (node.isText) {
      const text = node.text ?? "";
      let idx = 0;
      let foundIdx = text.indexOf(searchTerm, idx);
      while (foundIdx !== -1) {
        const from = pos + foundIdx;
        matches.push({ from, to: from + searchTerm.length });
        idx = foundIdx + 1;
        foundIdx = text.indexOf(searchTerm, idx);
      }
    }
  });
  return matches;
}

export function FindReplace({ editor, onClose }: FindReplaceProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matches, setMatches] = useState<{ from: number; to: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editor) return;

    const plugin = new Plugin({
      key: new PluginKey("findReplaceSearch"),
      state: {
        init() {
          return DecorationSet.empty;
        },
        apply(tr, set) {
          const searchTerm = tr.getMeta("findReplaceSearchTerm");
          if (searchTerm !== undefined) {
            if (!searchTerm) return DecorationSet.empty;
            const decorations: Decoration[] = [];
            tr.doc.descendants((node, pos) => {
              if (node.isText) {
                const text = node.text ?? "";
                let idx = 0;
                let foundIdx = text.indexOf(searchTerm, idx);
                while (foundIdx !== -1) {
                  decorations.push(
                    Decoration.inline(pos + foundIdx, pos + foundIdx + searchTerm.length, {
                      class: "bg-yellow-200 rounded-sm dark:bg-yellow-600",
                    }),
                  );
                  idx = foundIdx + 1;
                  foundIdx = text.indexOf(searchTerm, idx);
                }
              }
            });
            return DecorationSet.create(tr.doc, decorations);
          }
          return set.map(tr.mapping, tr.doc);
        },
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      if (editor) {
        editor.view.dispatch(editor.state.tr.setMeta("findReplaceSearchTerm", ""));
      }
      editor.unregisterPlugin("findReplaceSearch");
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta("findReplaceSearchTerm", findText));
    if (findText && editor.state.doc) {
      setMatches(findAllMatches(editor.state.doc, findText));
      setCurrentMatchIndex(0);
    } else {
      setMatches([]);
      setCurrentMatchIndex(0);
    }
  }, [editor, findText]);

  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!editor || matches.length === 0) return;
    const currentMatch = matches[currentMatchIndex];
    if (!currentMatch) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: currentMatch.from, to: currentMatch.to })
      .scrollIntoView()
      .run();
  }, [editor, matches, currentMatchIndex]);

  const findNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1 < matches.length ? prev + 1 : 0));
  }, [matches.length]);

  const findPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
  }, [matches.length]);

  const replace = useCallback(() => {
    if (matches.length === 0 || !editor) return;
    const currentMatch = matches[currentMatchIndex];
    if (!currentMatch) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: currentMatch.from, to: currentMatch.to })
      .deleteSelection()
      .insertContent(replaceText)
      .run();

    const newMatches = findAllMatches(editor.state.doc, findText);
    setMatches(newMatches);
    const nextIdx = Math.min(currentMatchIndex, newMatches.length - 1);
    setCurrentMatchIndex(nextIdx);
    editor.view.dispatch(editor.state.tr.setMeta("findReplaceSearchTerm", findText));
  }, [editor, matches, currentMatchIndex, replaceText, findText]);

  const replaceAll = useCallback(() => {
    if (!editor || matches.length === 0) return;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (!m) continue;
      editor
        .chain()
        .focus()
        .setTextSelection({ from: m.from, to: m.to })
        .deleteSelection()
        .insertContent(replaceText)
        .run();
    }
    const newMatches = findAllMatches(editor.state.doc, findText);
    setMatches(newMatches);
    setCurrentMatchIndex(0);
    editor.view.dispatch(editor.state.tr.setMeta("findReplaceSearchTerm", findText));
  }, [editor, matches, replaceText, findText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? findPrev() : findNext();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!editor) return null;

  return (
    <div className="absolute right-4 top-16 z-50 w-80 rounded-lg border border-border bg-white p-4 shadow-lg dark:border-border-dark dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Find & Replace</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        <div className="relative">
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find..."
            className="w-full rounded border border-border px-3 py-1.5 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>
        <input
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Replace..."
          className="w-full rounded border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {matches.length > 0
              ? `${currentMatchIndex + 1} of ${matches.length} matches`
              : findText
                ? "No matches"
                : ""}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={findPrev} disabled={matches.length === 0}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={findNext} disabled={matches.length === 0}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={replace}
            disabled={matches.length === 0}
          >
            Replace
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={replaceAll}
            disabled={matches.length === 0}
          >
            Replace All
          </Button>
        </div>
      </div>
    </div>
  );
}
