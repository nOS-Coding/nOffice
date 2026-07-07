import { Mark } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      setIndent: (indent: string) => ReturnType;
      unsetIndent: () => ReturnType;
    };
  }
}

export const Indent = Mark.create({
  name: "indent",

  addAttributes() {
    return {
      indent: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.marginLeft || null,
        renderHTML: (attrs) => {
          if (!attrs.indent) return {};
          return { style: `margin-left: ${attrs.indent}` };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        style: "margin-left",
        getAttrs: (value) => (value ? {} : false),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setIndent:
        (indent: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { indent });
        },
      unsetIndent:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
