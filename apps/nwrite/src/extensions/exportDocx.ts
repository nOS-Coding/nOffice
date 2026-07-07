import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export async function exportDocx(editorHtml: string): Promise<void> {
  const temp = document.createElement("div");
  temp.innerHTML = editorHtml;

  const paragraphs: Paragraph[] = [];

  function processInline(el: HTMLElement): TextRun[] {
    const runs: TextRun[] = [];
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          runs.push(new TextRun({ text }));
        }
      } else if (node instanceof HTMLElement) {
        const tag = node.tagName.toLowerCase();
        const text = node.textContent ?? "";
        if (!text) continue;
        const options: Record<string, unknown> = { text };
        if (tag === "strong" || tag === "b") options.bold = true;
        if (tag === "em" || tag === "i") options.italics = true;
        if (tag === "u" || tag === "ins") options.underline = { type: "single" };
        if (tag === "s" || tag === "strike" || tag === "del") options.strike = true;
        if (tag === "sub") options.subscript = true;
        if (tag === "sup") options.superscript = true;
        if (tag === "code") options.font = "Courier New";
        runs.push(new TextRun(options));
      }
    }
    return runs;
  }

  const headingMap: Record<string, string> = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
  };

  for (const child of temp.children) {
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    const runs = processInline(child);

    if (runs.length === 0 && (!child.textContent || !child.textContent.trim())) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
      continue;
    }

    const heading = headingMap[tag];
    if (heading) {
      paragraphs.push(
        new Paragraph({
          children: runs,
          heading: heading as "Heading1" | "Heading2" | "Heading3",
          spacing: { before: 240, after: 120 },
        }),
      );
    } else if (tag === "ul" || tag === "ol") {
      const items = child.querySelectorAll("li");
      for (const item of items) {
        if (!(item instanceof HTMLElement)) continue;
        const itemRuns = processInline(item);
        paragraphs.push(
          new Paragraph({
            children: itemRuns,
            bullet: tag === "ul" ? { level: 0 } : undefined,
            spacing: { after: 60 },
          }),
        );
      }
    } else if (tag === "blockquote") {
      paragraphs.push(
        new Paragraph({
          children: runs,
          indent: { left: 720, right: 720 },
          spacing: { before: 120, after: 120 },
        }),
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: runs,
          spacing: { after: 120 },
        }),
      );
    }
  }

  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "document.docx";
  a.click();
  URL.revokeObjectURL(url);
}
