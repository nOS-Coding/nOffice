import { AISidebar, useTheme } from "@noffice/ui-core";
import { useEffect, useRef, useState } from "react";

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
  MUTLAK: { english: "ABS", args: "sayı", desc: "Mutlak değer alır" },
  ABS: { english: "ABS", args: "number", desc: "Absolute value" },
  YUVARLA: { english: "ROUND", args: "sayı; basamak", desc: "Sayıyı belirtilen basamak sayısına yuvarlar" },
  ROUND: { english: "ROUND", args: "number; digits", desc: "Rounds number to specified digits" },
  BUGÜN: { english: "TODAY", args: "", desc: "Bugünün tarihini döndürür" },
  TODAY: { english: "TODAY", args: "", desc: "Returns today's date" },
  UZUNLUK: { english: "LEN", args: "metin", desc: "Metnin uzunluğunu döndürür" },
  LEN: { english: "LEN", args: "text", desc: "Returns length of text" },
  BÜYÜKHARF: { english: "UPPER", args: "metin", desc: "Metni büyük harfe çevirir" },
  UPPER: { english: "UPPER", args: "text", desc: "Converts text to uppercase" },
  KÜÇÜKHARF: { english: "LOWER", args: "metin", desc: "Metni küçük harfe çevirir" },
  LOWER: { english: "LOWER", args: "text", desc: "Converts text to lowercase" },
  VLOOKUP: { english: "VLOOKUP", args: "lookup_value; table_array; col_index; [range_lookup]", desc: "Looks up a value in the first column of a range and returns a value from the specified column" },
  SUMIF: { english: "SUMIF", args: "range; criteria; sum_range", desc: "Sums cells based on a condition" },
  COUNTIF: { english: "COUNTIF", args: "range; criteria", desc: "Counts cells based on a condition" },
};

function resolveCellValue(key: string, data: Record<string, string | number>): number {
  const raw = data[key];
  if (raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
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
  const colStrStart = startMatch[1]!;
  let startCol = 0;
  for (let j = 0; j < colStrStart.length; j++) {
    startCol = startCol * 26 + (colStrStart.charCodeAt(j) - 64);
  }
  startCol--;
  const startRow = parseInt(startMatch[2] as string) - 1;
  const colStrEnd = endMatch[1]!;
  let endCol = 0;
  for (let j = 0; j < colStrEnd.length; j++) {
    endCol = endCol * 26 + (colStrEnd.charCodeAt(j) - 64);
  }
  endCol--;
  const endRow = parseInt(endMatch[2] as string) - 1;
  const cells: string[] = [];
  for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
      cells.push(`${String.fromCharCode(65 + c)}${r + 1}`);
    }
  }
  return cells;
}

function parseRangeAsGrid(rangeStr: string): string[][] {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return [[rangeStr]];
  const part0 = parts[0]!;
  const part1 = parts[1]!;
  const startMatch = part0.match(/^([A-Z]+)(\d+)$/);
  const endMatch = part1.match(/^([A-Z]+)(\d+)$/);
  if (!startMatch || !endMatch) return [[rangeStr]];
  const colToIdx = (s: string): number => {
    let idx = 0;
    for (let j = 0; j < s.length; j++) idx = idx * 26 + (s.charCodeAt(j) - 64);
    return idx - 1;
  };
  const sc = colToIdx(startMatch[1]!);
  const sr = parseInt(startMatch[2]!) - 1;
  const ec = colToIdx(endMatch[1]!);
  const er = parseInt(endMatch[2]!) - 1;
  const rows: string[][] = [];
  for (let r = Math.min(sr, er); r <= Math.max(sr, er); r++) {
    const row: string[] = [];
    for (let c = Math.min(sc, ec); c <= Math.max(sc, ec); c++) {
      row.push(`${String.fromCharCode(65 + c)}${r + 1}`);
    }
    rows.push(row);
  }
  return rows;
}

function matchCriteria(cellValue: string | number, criteria: string): boolean {
  const strVal = String(cellValue);
  const cleaned = criteria.replace(/^"+|"+$/g, "");
  const opMatch = cleaned.match(/^(>=|<=|<>|>|<|=)?(.+)$/);
  if (!opMatch) return strVal === cleaned;
  const op = opMatch[1];
  const rest = opMatch[2] ?? "";
  if (!op || op === "=") return strVal === rest;
  const numVal = typeof cellValue === "number" ? cellValue : Number(strVal);
  const isNum = !isNaN(numVal) && strVal !== "";
  const critNum = Number(rest);
  if (!isNum || isNaN(critNum)) return false;
  switch (op) {
    case ">": return numVal > critNum;
    case "<": return numVal < critNum;
    case ">=": return numVal >= critNum;
    case "<=": return numVal <= critNum;
    case "<>": return numVal !== critNum;
    default: return strVal === rest;
  }
}

function collectArgs(tokens: string[], start: number): { args: string[]; end: number } {
  const args: string[] = [];
  let depth = 1;
  let current = "";
  let i = start;
  while (i < tokens.length && depth > 0) {
    const tok = tokens[i];
    if (tok === "(") depth++;
    else if (tok === ")") {
      depth--;
      if (depth > 0) current += tok;
      if (depth === 0) break;
    }
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

function evalExpr(tokens: string[], start: number, end: number, data: Record<string, string | number>): { value: number; end: number } {
  function parseExpr(pos: number, minPrec: number): { value: number; pos: number } {
    let i = pos;
    let left: number;
    const tok = tokens[i];
    if (tok === undefined) return { value: 0, pos: i };
    if (tok === "-") {
      i++;
      const sub = parseExpr(i, 3);
      left = -sub.value;
      i = sub.pos;
    } else if (tok === "+") {
      i++;
      const sub = parseExpr(i, 3);
      left = sub.value;
      i = sub.pos;
    } else if (tok === "(") {
      const sub = parseExpr(i + 1, 0);
      left = sub.value;
      i = sub.pos;
      if (tokens[i] === ")") i++;
    } else if (tok.length > 0 && tok.charAt(0) >= "A" && tok.charAt(0) <= "Z") {
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
        if (fn === "TOPLA" || fn === "SUM") left = nums.reduce((s, n) => s + n, 0);
        else if (fn === "ORTALAMA" || fn === "AVERAGE") left = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
        else if (fn === "MAK" || fn === "MAX") left = Math.max(...nums);
        else if (fn === "MİN" || fn === "MIN") left = Math.min(...nums);
        else if (fn === "SAY" || fn === "COUNT") {
          let count = 0;
          for (const a of funcArgs) {
            const trimmed = a.trim();
            if (!trimmed) continue;
            const cellMatch = trimmed.match(/^([A-Z]+)(\d+)$/);
            if (cellMatch) {
              const raw = data[trimmed];
              if (raw !== undefined && raw !== "" && !isNaN(Number(raw))) count++;
            } else if (trimmed.includes(":")) {
              const rangeCells = parseRange(trimmed);
              for (const c of rangeCells) {
                const raw = data[c];
                if (raw !== undefined && raw !== "" && !isNaN(Number(raw))) count++;
              }
            } else if (!isNaN(Number(trimmed))) {
              count++;
            }
          }
          left = count;
        } else if (fn === "EĞER" || fn === "IF") left = (nums[0] ?? 0) !== 0 ? (nums[1] ?? 0) : (nums[2] ?? 0);
        else if (fn === "MUTLAK" || fn === "ABS") left = Math.abs(nums[0] || 0);
        else if (fn === "YUVARLA" || fn === "ROUND") {
          const val = nums[0] || 0;
          const digits = nums[1] || 0;
          const factor = Math.pow(10, digits);
          left = Math.round(val * factor) / factor;
        }
        else if (fn === "UZUNLUK" || fn === "LEN") {
          const arg = (funcArgs[0] || "").trim();
          const cellMatch = arg.match(/^([A-Z]+)(\d+)$/);
          if (cellMatch) {
            left = String(data[arg] ?? "").length;
          } else {
            left = arg.length;
          }
        }
        else if (fn === "BUGÜN" || fn === "TODAY") {
          left = Math.floor(Date.now() / 86400000);
        }
        else if (fn === "BÜYÜKHARF" || fn === "UPPER") {
          const arg = (funcArgs[0] || "").trim();
          const cellMatch = arg.match(/^([A-Z]+)(\d+)$/);
          const str = cellMatch ? String(data[arg] ?? "") : arg;
          left = parseFloat(str.toUpperCase()) || 0;
        }
        else if (fn === "KÜÇÜKHARF" || fn === "LOWER") {
          const arg = (funcArgs[0] || "").trim();
          const cellMatch = arg.match(/^([A-Z]+)(\d+)$/);
          const str = cellMatch ? String(data[arg] ?? "") : arg;
          left = parseFloat(str.toLowerCase()) || 0;
        }
        else if (fn === "VLOOKUP") {
          const lookupArg = (funcArgs[0] || "").trim();
          const tableRange = (funcArgs[1] || "").trim();
          const colIdx = parseInt((funcArgs[2] || "").trim()) - 1;
          const lookupCellMatch = lookupArg.match(/^([A-Z]+)(\d+)$/);
          const lookupValue = lookupCellMatch ? String(data[lookupArg] ?? "") : lookupArg.replace(/^"+|"+$/g, "");
          const grid = parseRangeAsGrid(tableRange);
          let found = 0;
          for (const r of grid) {
            if (r.length > 0 && String(data[r[0]!] ?? "") === lookupValue) {
              if (colIdx >= 0 && colIdx < r.length) found = resolveCellValue(r[colIdx]!, data);
              break;
            }
          }
          left = found;
        }
        else if (fn === "SUMIF") {
          const checkRange = (funcArgs[0] || "").trim();
          let criteria = (funcArgs[1] || "").trim();
          const sumRange = (funcArgs[2] || "").trim();
          const critCellMatch = criteria.match(/^([A-Z]+)(\d+)$/);
          if (critCellMatch) criteria = String(data[criteria] ?? "");
          const checkCells = parseRange(checkRange);
          const sumCells = sumRange ? parseRange(sumRange) : checkCells;
          let total = 0;
          for (let i = 0; i < checkCells.length; i++) {
            const cv = data[checkCells[i]!] ?? "";
            if (matchCriteria(cv, criteria)) {
              total += resolveCellValue(i < sumCells.length ? sumCells[i]! : checkCells[i]!, data);
            }
          }
          left = total;
        }
        else if (fn === "COUNTIF") {
          const checkRange = (funcArgs[0] || "").trim();
          let criteria = (funcArgs[1] || "").trim();
          const critCellMatch = criteria.match(/^([A-Z]+)(\d+)$/);
          if (critCellMatch) criteria = String(data[criteria] ?? "");
          const checkCells = parseRange(checkRange);
          let count = 0;
          for (const ck of checkCells) {
            const cv = data[ck] ?? "";
            if (matchCriteria(cv, criteria)) count++;
          }
          left = count;
        }
        else left = 0;
        i = funcEnd + 1;
      } else {
        const cellMatch = tok.match(/^([A-Z]+)(\d+)$/);
        if (cellMatch) left = resolveCellValue(tok, data);
        else left = 0;
        i++;
      }
    } else {
      left = parseFloat(tok) || 0;
      i++;
    }
    while (i < end) {
      const op = tokens[i];
      if (op === undefined || op === ")" || op === "," || op === ";") break;
      const prec = (op === "+" || op === "-") ? 1 : (op === "^") ? 3 : 2;
      if (prec < minPrec) break;
      i++;
      const rhs = parseExpr(i, prec + 1);
      i = rhs.pos;
      if (op === "+") left += rhs.value;
      else if (op === "-") left -= rhs.value;
      else if (op === "*") left *= rhs.value;
      else if (op === "/") left /= rhs.value;
      else if (op === "^") left = Math.pow(left, rhs.value);
    }
    return { value: left, pos: i };
  }
  const result = parseExpr(start, 0);
  return { value: result.value, end: result.pos };
}

function evaluateFormula(formula: string, data: Record<string, string | number>): string {
  if (!formula.startsWith("=")) return formula;
  const expr = formula.slice(1);
  const tokens = tokenize(expr);
  if (tokens.length === 0) return formula;
  try {
    const fn0 = tokens[0];
    if (fn0 && (fn0 === "BUGÜN" || fn0 === "TODAY")) {
      if (tokens[1] === "(" && tokens[2] === ")" && tokens.length === 3) {
        return new Date().toISOString().split("T")[0] ?? "";
      }
    }
    const result = evalExpr(tokens, 0, tokens.length, data);
    if (isNaN(result.value) || !isFinite(result.value)) return formula;
    return Number.isInteger(result.value) ? result.value.toString() : result.value.toFixed(2);
  } catch {
    return formula;
  }
}

function computeAllFormulas(data: Record<string, string>): Record<string, string> {
  const display: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value.startsWith("=")) {
      display[key] = evaluateFormula(value, display);
    } else {
      const num = Number(value);
      display[key] = isNaN(num) ? value : num;
    }
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(display)) {
    result[key] = String(value);
  }
  return result;
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
    return `${COL_LABELS[col] ?? ""}${row + 1}`;
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
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (activeCell) setEditValue(data[activeCell] || "");
      setEditing(false);
    }
  }

  function handleExportCsv() {
    const rows: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      const cols: string[] = [];
      for (let col = 0; col < COLS; col++) {
        const key = cellKey(col, row);
        let val = getDisplayValue(key);
        if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        cols.push(val);
      }
      rows.push(cols.join(","));
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSort(ascending: boolean) {
    if (!activeCell) return;
    const colMatch = activeCell.match(/^([A-Z]+)/);
    if (!colMatch) return;
    const colLetter = colMatch[1]!;
    const rowEntries = Array.from({ length: ROWS }, (_, i) => ({
      index: i,
      value: getDisplayValue(`${colLetter}${i + 1}`),
    }));
    rowEntries.sort((a, b) => {
      const an = Number(a.value);
      const bn = Number(b.value);
      const aIsNum = !isNaN(an) && a.value !== "";
      const bIsNum = !isNaN(bn) && b.value !== "";
      if (aIsNum && bIsNum) return ascending ? an - bn : bn - an;
      if (a.value === "" && b.value === "") return 0;
      if (a.value === "") return ascending ? 1 : -1;
      if (b.value === "") return ascending ? -1 : 1;
      const cmp = a.value.localeCompare(b.value);
      return ascending ? cmp : -cmp;
    });
    setData((prev) => {
      const next: Record<string, string> = {};
      for (let c = 0; c < COLS; c++) {
        const cl = COL_LABELS[c]!;
        for (let nr = 0; nr < ROWS; nr++) {
          const or = rowEntries[nr]!.index;
          const src = `${cl}${or + 1}`;
          const dst = `${cl}${nr + 1}`;
          if (prev[src] !== undefined) next[dst] = prev[src]!;
        }
      }
      return next;
    });
  }

  const visibleCols = Math.ceil(window.innerWidth / COL_WIDTH);
  const visibleRows = Math.ceil(600 / ROW_HEIGHT);

  const activeFormula = activeCell && hasFormula(data[activeCell] || "");

  useEffect(() => {
    try {
      const savedData = localStorage.getItem("nsheet-data");
      const savedStyles = localStorage.getItem("nsheet-styles");
      if (savedData) setData(JSON.parse(savedData));
      if (savedStyles) setCellStyles(JSON.parse(savedStyles));
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("nsheet-data", JSON.stringify(data));
      localStorage.setItem("nsheet-styles", JSON.stringify(cellStyles));
    }, 500);
    return () => clearTimeout(timer);
  }, [data, cellStyles]);

  useEffect(() => {
    if (activeCell) {
      setEditValue(data[activeCell] || "");
    } else {
      setEditValue("");
    }
  }, [activeCell]);

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
                {Object.entries(FORMULA_FUNCTIONS).filter(([k]) => k === k.toUpperCase() && !["SUM","AVERAGE","MAX","MIN","COUNT","IF","ABS","ROUND","TODAY","LEN","UPPER","LOWER"].includes(k)).map(([name, info]) => (
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
        <button
          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={handleExportCsv}
          title="Export as CSV"
        >
          Export CSV
        </button>
        <button
          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => handleSort(true)}
          title="Sort A-Z"
        >
          Sort A-Z
        </button>
        <button
          className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => handleSort(false)}
          title="Sort Z-A"
        >
          Sort Z-A
        </button>
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
