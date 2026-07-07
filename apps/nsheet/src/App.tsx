import { AISidebar, useTheme } from "@noffice/ui-core";
import { useRef, useState } from "react";

const COLS = 26;
const ROWS = 100;
const COL_WIDTH = 100;
const ROW_HEIGHT = 28;

const COL_LABELS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));

interface CellStyle {
  color: string;
  bold: boolean;
}

const FORMULA_FUNCTIONS: Record<string, { english: string; args: string; desc: string }> = {
  TOPLA: { english: "SUM", args: "sayı1; sayı2; ...", desc: "Sayıları toplar" },
  SUM: { english: "SUM", args: "number1; number2; ...", desc: "Adds numbers" },
  ORTALAMA: { english: "AVERAGE", args: "sayı1; sayı2; ...", desc: "Sayıların ortalamasını alır" },
  AVERAGE: { english: "AVERAGE", args: "number1; number2; ...", desc: "Average of numbers" },
  MAK: { english: "MAX", args: "sayı1; sayı2; ...", desc: "En büyük değeri bulur" },
  MAX: { english: "MAX", args: "number1; number2; ...", desc: "Finds the maximum value" },
  MİN: { english: "MIN", args: "sayı1; sayı2; ...", desc: "En küçük değeri bulur" },
  MIN: { english: "MIN", args: "number1; number2; ...", desc: "Finds the minimum value" },
  SAY: { english: "COUNT", args: "sayı1; sayı2; ...", desc: "Sayıları sayar" },
  COUNT: { english: "COUNT", args: "number1; number2; ...", desc: "Counts numbers" },
  EĞER: { english: "IF", args: "koşul; doğruysa; yanlışsa", desc: "Koşula göre değer döndürür" },
  IF: { english: "IF", args: "condition; true_value; false_value", desc: "Returns value based on condition" },
};

function resolveCellValue(key: string, data: Record<string, string>): number {
  const raw = data[key];
  if (raw === undefined || raw === "") return 0;
  const num = Number(raw);
  if (!isNaN(num)) return num;
  return 0;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === undefined) break;
    if (ch === " " || ch === "\t") { i++; continue; }
    if ("+-*/(),".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (ch >= "0" && ch <= "9" || ch === ".") {
      let num = "";
      while (i < expr.length) {
        const c = expr[i];
        if (c === undefined) break;
        if (c >= "0" && c <= "9" || c === ".") { num += c; i++; }
        else break;
      }
      tokens.push(num);
    } else if (ch >= "A" && ch <= "Z" || ch >= "a" && ch <= "z" || ch >= "Ç" && ch <= "ş") {
      let word = "";
      while (i < expr.length) {
        const c = expr[i];
        if (c === undefined) break;
        if (c >= "A" && c <= "Z" || c >= "a" && c <= "z" || c >= "0" && c <= "9" || c >= "Ç" && c <= "ş" || c === "İ" || c === "ı" || c === "ğ" || c === "Ğ" || c === "ü" || c === "Ü" || c === "ö" || c === "Ö" || c === "ş" || c === "Ş") {
          word += c; i++;
        } else break;
      }
      tokens.push(word.toUpperCase());
    } else {
      tokens.push(ch); i++;
    }
  }
  return tokens;
}

function parseRange(rangeStr: string): string[] {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return [rangeStr];
  const part0 = parts[0];
  const part1 = parts[1];
  if (!part0 || !part1) return [rangeStr];
  const startMatch = part0.match(/^([A-Z]+)(\d+)$/);
  const endMatch = part1.match(/^([A-Z]+)(\d+)$/);
  if (!startMatch || !endMatch) return [rangeStr];
  const startCol = (startMatch[1] as string).charCodeAt(0) - 65;
  const startRow = parseInt(startMatch[2] as string) - 1;
  const endCol = (endMatch[1] as string).charCodeAt(0) - 65;
  const endRow = parseInt(endMatch[2] as string) - 1;
  const cells: string[] = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push(`${String.fromCharCode(65 + c)}${r + 1}`);
    }
  }
  return cells;
}

function collectArgs(tokens: string[], start: number): { args: string[]; end: number } {
  const args: string[] = [];
  let depth = 1;
  let current = "";
  let i = start;
  while (i < tokens.length && depth > 0) {
    const tok = tokens[i];
    if (tok === "(") depth++;
    else if (tok === ")") { depth--; if (depth === 0) break; }
    if (tok === ";" && depth === 1) {
      args.push(current.trim());
      current = "";
      i++;
      continue;
    }
    current += tok;
    i++;
  }
  if (current.trim()) args.push(current.trim());
  return { args, end: i };
}

function evalExpr(tokens: string[], start: number, end: number, data: Record<string, string>): { value: number; end: number } {
  let result = 0;
  let op = "+";
  let i = start;
  while (i < end) {
    const tok = tokens[i];
    if (tok === undefined) break;
    if (tok === "+" || tok === "-") { op = tok; i++; continue; }
    let term: number;
    if (tok === "(") {
      const sub = evalExpr(tokens, i + 1, end, data);
      term = sub.value;
      i = sub.end + 1;
    } else if (tok === "*" || tok === "/") {
      op = tok; i++; continue;
    } else if (!!tok && tok[0]! >= "A" && tok[0]! <= "Z") {
      const possibleFunc = tok.toUpperCase();
      const nextTok = tokens[i + 1];
      if (nextTok === "(" && FORMULA_FUNCTIONS[possibleFunc]) {
        const { args: funcArgs, end: funcEnd } = collectArgs(tokens, i + 2);
        const nums = funcArgs.map(a => {
          const cellMatch = a.match(/^([A-Z]+)(\d+)$/);
          if (cellMatch) return resolveCellValue(a, data);
          if (a.includes(":")) {
            const rangeCells = parseRange(a);
            return rangeCells.reduce((s, c) => s + resolveCellValue(c, data), 0);
          }
          const subTokens = tokenize(a);
          const sub = evalExpr(subTokens, 0, subTokens.length, data);
          return sub.value;
        });
        const fn = possibleFunc;
        if (fn === "TOPLA" || fn === "SUM") term = nums.reduce((s, n) => s + n, 0);
        else if (fn === "ORTALAMA" || fn === "AVERAGE") term = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        else if (fn === "MAK" || fn === "MAX") term = Math.max(...nums);
        else if (fn === "MİN" || fn === "MIN") term = Math.min(...nums);
        else if (fn === "SAY" || fn === "COUNT") term = nums.length;
        else if (fn === "EĞER" || fn === "IF") term = nums[0] !== 0 ? nums[1] || 0 : nums[2] || 0;
        else term = 0;
        i = funcEnd + 1;
      } else {
        const cellMatch = tok.match(/^([A-Z]+)(\d+)$/);
        if (cellMatch) term = resolveCellValue(tok, data);
        else term = 0;
        i++;
      }
    } else if (tok === "*") { i++; continue; }
           else if (tok === "/") { i++; continue; }
           else {
      term = parseFloat(tok) || 0;
      i++;
    }
    if (op === "+") result += term;
    else if (op === "-") result -= term;
    else if (op === "*") result *= term;
    else if (op === "/" && term !== 0) result /= term;
    op = "+";
  }
  return { value: result, end: i };
}

function evaluateFormula(formula: string, data: Record<string, string>): string {
  if (!formula.startsWith("=")) return formula;
  const expr = formula.slice(1);
  const tokens = tokenize(expr);
  if (tokens.length === 0) return formula;
  try {
    const result = evalExpr(tokens, 0, tokens.length, data);
    if (isNaN(result.value) || !isFinite(result.value)) return formula;
    return Number.isInteger(result.value) ? result.value.toString() : result.value.toFixed(2);
  } catch {
    return formula;
  }
}

function computeAllFormulas(data: Record<string, string>): Record<string, string> {
  const display: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value.startsWith("=")) {
      display[key] = evaluateFormula(value, data);
    } else {
      display[key] = value;
    }
  }
  return display;
}

function hasFormula(value: string): boolean {
  return value.startsWith("=");
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTheme();

  const [data, setData] = useState<Record<string, string>>({});
  const [cellStyles, setCellStyles] = useState<Record<string, CellStyle>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [cellTextColor, setCellTextColor] = useState("#000000");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayData = computeAllFormulas(data);

  function cellKey(col: number, row: number) {
    return `${COL_LABELS[col]}${row + 1}`;
  }

  function getDisplayValue(key: string): string {
    return displayData[key] ?? "";
  }

  function handleCellClick(col: number, row: number) {
    const key = cellKey(col, row);
    setActiveCell(key);
    setEditValue(data[key] || "");
    setEditing(true);
    const style = cellStyles[key];
    if (style) setCellTextColor(style.color);
    else setCellTextColor("#000000");
  }

  function handleCellBlur() {
    if (activeCell) {
      setData((prev) => {
        const next = { ...prev };
        if (editValue) next[activeCell] = editValue;
        else delete next[activeCell];
        return next;
      });
      if (editValue.startsWith("=")) {
        setCellStyles((prev) => ({
          ...prev,
          [activeCell]: { color: "#0000ff", bold: prev[activeCell]?.bold ?? false },
        }));
      }
    }
    setEditing(false);
  }

  function handleFormulaChange(value: string) {
    setEditValue(value);
    if (activeCell) {
      setData((prev) => {
        const next = { ...prev };
        if (value) next[activeCell] = value;
        else delete next[activeCell];
        return next;
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, col: number, row: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCellBlur();
      if (row + 1 < ROWS) setActiveCell(cellKey(col, row + 1));
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleCellBlur();
      if (col + 1 < COLS) setActiveCell(cellKey(col + 1, row));
      else if (row + 1 < ROWS) setActiveCell(cellKey(0, row + 1));
    } else if (e.key === "ArrowUp" && row > 0) {
      e.preventDefault();
      handleCellBlur();
      setActiveCell(cellKey(col, row - 1));
    } else if (e.key === "ArrowDown" && row + 1 < ROWS) {
      e.preventDefault();
      handleCellBlur();
      setActiveCell(cellKey(col, row + 1));
    } else if (e.key === "ArrowLeft" && col > 0) {
      e.preventDefault();
      handleCellBlur();
      setActiveCell(cellKey(col - 1, row));
    } else if (e.key === "ArrowRight" && col + 1 < COLS) {
      e.preventDefault();
      handleCellBlur();
      setActiveCell(cellKey(col + 1, row));
    }
  }

  const visibleCols = Math.ceil(window.innerWidth / COL_WIDTH);
  const visibleRows = Math.ceil(600 / ROW_HEIGHT);

  const activeFormula = activeCell && hasFormula(data[activeCell] || "");

  return (
    <div className="flex h-screen flex-col">
      <style>{`
        .sheet-cell {
          background: #ffffff !important;
          color: inherit;
        }
        .sheet-cell-active {
          box-shadow: inset 0 0 0 2px #4c6ef5;
        }
        .cheatsheet-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
        }
        .cheatsheet-panel {
          position: absolute;
          z-index: 50;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          padding: 12px;
          min-width: 320px;
        }
        .dark .cheatsheet-panel {
          background: #25262b;
          border-color: #373a40;
        }
      `}</style>
      <div className="flex items-center gap-2 border-b border-border px-4 py-1 dark:border-border-dark">
        <span className="text-xs font-medium text-gray-400">fx</span>
        <input
          ref={inputRef}
          className="flex-1 rounded border border-border bg-white px-2 py-1 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
          value={activeCell ? editValue : ""}
          onChange={(e) => handleFormulaChange(e.target.value)}
          onFocus={() => setEditing(true)}
          placeholder={activeCell ? activeCell : "Select a cell"}
        />
        <div className="relative">
          <button
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setShowCheatsheet(!showCheatsheet)}
            title="Formula cheatsheet"
          >
            ?
          </button>
          {showCheatsheet && (
            <>
              <div className="cheatsheet-overlay" onClick={() => setShowCheatsheet(false)} />
              <div className="cheatsheet-panel right-0 top-full mt-1">
                <p className="mb-2 text-xs font-semibold text-gray-500">Formulas</p>
                {Object.entries(FORMULA_FUNCTIONS).filter(([k]) => k === k.toUpperCase() && !["SUM","AVERAGE","MAX","MIN","COUNT","IF"].includes(k)).map(([name, info]) => (
                  <div key={name} className="mb-2 rounded bg-gray-50 p-2 dark:bg-surface-dark-tertiary">
                    <code className="text-sm font-bold text-brand-600">={name}({info.args})</code>
                    <p className="text-xs text-gray-500 mt-0.5">{info.desc}</p>
                    <p className="text-[10px] text-gray-400">English: {info.english}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <label className="text-xs text-gray-500">Color</label>
          <input
            type="color"
            value={cellTextColor}
            onChange={(e) => {
              const newColor = e.target.value;
              setCellTextColor(newColor);
              const ac = activeCell;
              if (ac) {
                setCellStyles((prev) => ({
                  ...prev,
                  [ac]: { color: newColor, bold: prev[ac]?.bold ?? false },
                }));
              }
            }}
            className="h-5 w-6 cursor-pointer rounded border-0 p-0"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="rounded px-2 py-0.5 text-[11px] font-medium text-gray-500 bg-surface-tertiary dark:bg-surface-dark-tertiary">
            Sheet 1
          </span>
          <button
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            AI
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-surface-secondary dark:bg-surface-dark-secondary">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-7 w-10 bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary" />
              {COL_LABELS.slice(0, visibleCols + 2).map((label) => (
                <th
                  key={label}
                  className="sticky top-0 z-10 h-7 w-[100px] bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary"
                  style={{ minWidth: COL_WIDTH }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.min(visibleRows + 2, ROWS) }, (_, row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 h-7 w-10 bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary">
                  {row + 1}
                </td>
                {COL_LABELS.slice(0, visibleCols + 2).map((_, col) => {
                  const key = cellKey(col, row);
                  const isActive = activeCell === key;
                  const style = cellStyles[key];
                  const display = getDisplayValue(key);
                  const isFormula = hasFormula(data[key] || "");
                  return (
                    <td
                      key={col}
                      className={`h-7 border border-border px-2 text-sm outline-none dark:border-border-dark ${
                        isActive ? "sheet-cell-active" : ""
                      }`}
                      style={{
                        minWidth: COL_WIDTH,
                        background: "#ffffff",
                        color: style?.color || (isFormula ? "#0000ff" : "#000000"),
                        fontWeight: style?.bold ? "bold" : "normal",
                      }}
                      tabIndex={0}
                      onClick={() => handleCellClick(col, row)}
                      onDoubleClick={() => handleCellClick(col, row)}
                      onKeyDown={(e) => handleKeyDown(e, col, row)}
                    >
                      {isActive && editing ? (
                        <input
                          className="h-full w-full bg-transparent outline-none"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          autoFocus
                        />
                      ) : (
                        <span>{display}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeFormula && (
        <div className="border-t border-border bg-blue-50 px-4 py-1 text-xs text-blue-700 dark:border-border-dark dark:bg-blue-900/20 dark:text-blue-300">
          Formula result: {activeCell ? getDisplayValue(activeCell) : ""}
        </div>
      )}

      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nSheet Spreadsheet" />
    </div>
  );
}

export { App as default, App };
