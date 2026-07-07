import { AISidebar, useTheme } from "@noffice/ui-core";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

const COLS = 26;
const ROWS = 100;
const COL_WIDTH = 100;
const ROW_HEIGHT = 28;

const COL_LABELS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));

interface CellStyle {
  color: string;
  bold: boolean;
}

interface Sheet {
  id: string;
  name: string;
  data: Record<string, string>;
  cellStyles: Record<string, CellStyle>;
  mergedCells: string[];
  frozenRows: number;
  frozenCols: number;
  conditionalRules: ConditionalRule[];
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  history: string[];
  historyIndex: number;
}

interface ConditionalRule {
  range: string;
  type: "cellValue" | "formula";
  operator: string;
  value: string;
  style: { color?: string; bold?: boolean; bgColor?: string };
}

interface ContextMenuState {
  x: number;
  y: number;
  cellKey: string;
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
  AND: { english: "AND", args: "logical1; logical2; ...", desc: "Returns 1 if all arguments are true" },
  OR: { english: "OR", args: "logical1; logical2; ...", desc: "Returns 1 if any argument is true" },
  NOT: { english: "NOT", args: "logical", desc: "Returns 1 if argument is false" },
  CONCAT: { english: "CONCAT", args: "text1; text2; ...", desc: "Concatenates text strings" },
  TRIM: { english: "TRIM", args: "text", desc: "Removes extra spaces from text" },
  TEXT: { english: "TEXT", args: "value; format_text", desc: "Formats a number as text" },
  DATE: { english: "DATE", args: "year; month; day", desc: "Returns days since epoch for a date" },
  YEAR: { english: "YEAR", args: "serial_number", desc: "Returns year from date serial" },
  MONTH: { english: "MONTH", args: "serial_number", desc: "Returns month from date serial" },
  DAY: { english: "DAY", args: "serial_number", desc: "Returns day from date serial" },
  RAND: { english: "RAND", args: "", desc: "Returns a random number between 0 and 1" },
  RANDBETWEEN: { english: "RANDBETWEEN", args: "bottom; top", desc: "Returns a random integer between bottom and top" },
  MOD: { english: "MOD", args: "number; divisor", desc: "Returns remainder after division" },
  INT: { english: "INT", args: "number", desc: "Truncates number to integer" },
  POWER: { english: "POWER", args: "number; power", desc: "Returns number raised to power" },
};

const STRING_FORMULAS = new Set(["CONCAT", "TRIM", "TEXT"]);

function cellKey(col: number, row: number): string {
  return `${COL_LABELS[col] ?? ""}${row + 1}`;
}

function colToIdx(s: string): number {
  let idx = 0;
  for (let j = 0; j < s.length; j++) idx = idx * 26 + (s.charCodeAt(j) - 64);
  return idx - 1;
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { col: colToIdx(m[1]!), row: parseInt(m[2]!) - 1 };
}

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
  let startCol = 0;
  for (let j = 0; j < startMatch[1]!.length; j++) {
    startCol = startCol * 26 + (startMatch[1]!.charCodeAt(j) - 64);
  }
  startCol--;
  const startRow = parseInt(startMatch[2]!) - 1;
  let endCol = 0;
  for (let j = 0; j < endMatch[1]!.length; j++) {
    endCol = endCol * 26 + (endMatch[1]!.charCodeAt(j) - 64);
  }
  endCol--;
  const endRow = parseInt(endMatch[2]!) - 1;
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
        else if (fn === "AND") left = nums.every(n => n !== 0) ? 1 : 0;
        else if (fn === "OR") left = nums.some(n => n !== 0) ? 1 : 0;
        else if (fn === "NOT") left = (nums[0] ?? 0) !== 0 ? 0 : 1;
        else if (fn === "DATE") {
          const y = nums[0] ?? 0;
          const m = nums[1] ?? 1;
          const d = nums[2] ?? 1;
          left = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
        }
        else if (fn === "YEAR") { const dt = new Date((nums[0] ?? 0) * 86400000); left = dt.getUTCFullYear(); }
        else if (fn === "MONTH") { const dt = new Date((nums[0] ?? 0) * 86400000); left = dt.getUTCMonth() + 1; }
        else if (fn === "DAY") { const dt = new Date((nums[0] ?? 0) * 86400000); left = dt.getUTCDate(); }
        else if (fn === "RAND") left = Math.random();
        else if (fn === "RANDBETWEEN") { const b = nums[0] ?? 0; const t = nums[1] ?? 0; left = Math.floor(Math.random() * (t - b + 1)) + b; }
        else if (fn === "MOD") { const n = nums[0] ?? 0; const d = nums[1] ?? 1; left = n % d; }
        else if (fn === "INT") left = Math.trunc(nums[0] ?? 0);
        else if (fn === "POWER") left = Math.pow(nums[0] ?? 0, nums[1] ?? 0);
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

function evaluateStringFormula(tokens: string[], data: Record<string, string | number>): string {
  const fnName = tokens[0]?.toUpperCase() ?? "";
  if (!STRING_FORMULAS.has(fnName)) return "#VALUE!";
  const { args: funcArgs } = collectArgs(tokens, 2);
  const resolveArg = (a: string): string => {
    const trimmed = a.trim();
    const cellMatch = trimmed.match(/^([A-Z]+)(\d+)$/);
    if (cellMatch) return String(data[trimmed] ?? "");
    const strMatch = trimmed.match(/^"([^"]*)"$/);
    if (strMatch) return strMatch[1]!;
    return trimmed;
  };
  if (fnName === "CONCAT") return funcArgs.map(resolveArg).join("");
  if (fnName === "TRIM") return resolveArg(funcArgs[0] ?? "").trim();
  if (fnName === "TEXT") return String(resolveArg(funcArgs[0] ?? ""));
  return "";
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
    if (fn0 && STRING_FORMULAS.has(fn0)) {
      return evaluateStringFormula(tokens, data);
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

function buildMergeMaps(mergedCells: string[]): { skip: Set<string>; spans: Map<string, { colspan: number; rowspan: number }> } {
  const skip = new Set<string>();
  const spans = new Map<string, { colspan: number; rowspan: number }>();
  for (const mk of mergedCells) {
    const parts = mk.split(":");
    if (parts.length !== 2) continue;
    const tl = parts[0]!;
    const br = parts[1]!;
    const tlRef = parseCellRef(tl);
    const brRef = parseCellRef(br);
    if (!tlRef || !brRef) continue;
    const minCol = Math.min(tlRef.col, brRef.col);
    const maxCol = Math.max(tlRef.col, brRef.col);
    const minRow = Math.min(tlRef.row, brRef.row);
    const maxRow = Math.max(tlRef.row, brRef.row);
    const colSpan = maxCol - minCol + 1;
    const rowSpan = maxRow - minRow + 1;
    spans.set(tl, { colspan: colSpan, rowspan: rowSpan });
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const k = `${String.fromCharCode(65 + c)}${r + 1}`;
        if (k !== tl) skip.add(k);
      }
    }
  }
  return { skip, spans };
}

function applyConditionalRules(rules: ConditionalRule[], data: Record<string, string>, displayData: Record<string, string>): Record<string, { color?: string; bold?: boolean; bgColor?: string }> {
  const result: Record<string, { color?: string; bold?: boolean; bgColor?: string }> = {};
  for (const rule of rules) {
    const cells = parseRange(rule.range);
    for (const ck of cells) {
      const val = displayData[ck] ?? data[ck] ?? "";
      const numVal = Number(val);
      const isNum = !isNaN(numVal) && val !== "";
      let match = false;
      if (rule.type === "cellValue") {
        if (rule.operator === "greaterThan") match = isNum && numVal > Number(rule.value);
        else if (rule.operator === "lessThan") match = isNum && numVal < Number(rule.value);
        else if (rule.operator === "equalTo") match = val === rule.value;
        else if (rule.operator === "contains") match = val.includes(rule.value);
      }
      if (match) {
        result[ck] = { ...result[ck], ...rule.style };
      }
    }
  }
  return result;
}

let sheetIdCounter = 1;
function createSheet(name: string): Sheet {
  const id = `sheet${sheetIdCounter++}`;
  return {
    id,
    name,
    data: {},
    cellStyles: {},
    mergedCells: [],
    frozenRows: 0,
    frozenCols: 0,
    conditionalRules: [],
    colWidths: {},
    rowHeights: {},
    history: [JSON.stringify({ data: {}, cellStyles: {} })],
    historyIndex: 0,
  };
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useTheme();

  const [sheets, setSheets] = useState<Sheet[]>([createSheet("Sheet1")]);
  const [activeSheetId, setActiveSheetId] = useState(sheetIdCounter > 1 ? `sheet${sheetIdCounter - 1}` : "sheet1");
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [cellTextColor, setCellTextColor] = useState("#000000");
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [findMatches, setFindMatches] = useState<string[]>([]);
  const [showConditionalFormatting, setShowConditionalFormatting] = useState(false);
  const [cfRange, setCfRange] = useState("");
  const [cfOperator, setCfOperator] = useState("greaterThan");
  const [cfValue, setCfValue] = useState("");

  const [filterActive, setFilterActive] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterChecked, setFilterChecked] = useState<Record<string, Set<string>>>({});
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sheetRenameId, setSheetRenameId] = useState<string | null>(null);
  const [sheetRenameValue, setSheetRenameValue] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<{ startKey: string; isDragging: boolean }>({ startKey: "", isDragging: false });
  const resizeColRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  const resizeRowRef = useRef<{ row: number; startY: number; startHeight: number } | null>(null);
  const selectionStartRef = useRef<{ col: number; row: number } | null>(null);

  const activeSheet = sheets.find(s => s.id === activeSheetId) ?? sheets[0]!;
  const data = activeSheet.data;
  const cellStyles = activeSheet.cellStyles;
  const mergedCells = activeSheet.mergedCells;
  const frozenRows = activeSheet.frozenRows;
  const frozenCols = activeSheet.frozenCols;
  const conditionalRules = activeSheet.conditionalRules;
  const colWidths = activeSheet.colWidths;
  const rowHeights = activeSheet.rowHeights;
  const history = activeSheet.history;
  const historyIndex = activeSheet.historyIndex;

  const displayData = computeAllFormulas(data);
  const { skip: mergedSkip, spans: mergedSpans } = buildMergeMaps(mergedCells);
  const condStyles = applyConditionalRules(conditionalRules, data, displayData);
  const activeFormula = activeCell && hasFormula(data[activeCell] || "");

  function saveState() {
    const snapshot = JSON.stringify({ data, cellStyles });
    setSheets(prev => prev.map(s => s.id === activeSheetId ? {
      ...s,
      history: [...s.history.slice(0, s.historyIndex + 1), snapshot].slice(-100),
      historyIndex: Math.min(s.historyIndex + 1, 99),
    } : s));
  }

  function undo() {
    const s = sheets.find(sh => sh.id === activeSheetId);
    if (!s || s.historyIndex <= 0) return;
    const newIndex = s.historyIndex - 1;
    const snap = s.history[newIndex];
    if (!snap) return;
    const parsed = JSON.parse(snap) as { data: Record<string, string>; cellStyles: Record<string, CellStyle> };
    setSheets(prev => prev.map(sh => sh.id === activeSheetId ? {
      ...sh,
      data: parsed.data,
      cellStyles: parsed.cellStyles,
      historyIndex: newIndex,
    } : sh));
  }

  function redo() {
    const s = sheets.find(sh => sh.id === activeSheetId);
    if (!s || s.historyIndex >= s.history.length - 1) return;
    const newIndex = s.historyIndex + 1;
    const snap = s.history[newIndex];
    if (!snap) return;
    const parsed = JSON.parse(snap) as { data: Record<string, string>; cellStyles: Record<string, CellStyle> };
    setSheets(prev => prev.map(sh => sh.id === activeSheetId ? {
      ...sh,
      data: parsed.data,
      cellStyles: parsed.cellStyles,
      historyIndex: newIndex,
    } : sh));
  }

  function updateSheet(changes: Partial<Sheet>) {
    setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, ...changes } : s));
  }

  function addSheet() {
    const newSheet = createSheet(`Sheet${sheets.length + 1}`);
    setSheets(prev => [...prev, newSheet]);
    setActiveSheetId(newSheet.id);
  }

  function deleteSheet(id: string) {
    if (sheets.length <= 1) return;
    setSheets(prev => prev.filter(s => s.id !== id));
    if (activeSheetId === id) {
      const idx = sheets.findIndex(s => s.id === id);
      const nextSheet = sheets[idx - 1] ?? sheets[1] ?? sheets[0]!;
      setActiveSheetId(nextSheet.id);
    }
  }

  function startRenameSheet(id: string) {
    const s = sheets.find(sh => sh.id === id);
    if (!s) return;
    setSheetRenameId(id);
    setSheetRenameValue(s.name);
  }

  function finishRenameSheet() {
    if (sheetRenameId && sheetRenameValue.trim()) {
      updateSheet({ name: sheetRenameValue.trim() });
    }
    setSheetRenameId(null);
    setSheetRenameValue("");
  }

  function getDisplayValue(key: string): string {
    return displayData[key] ?? "";
  }

  function handleCellClick(col: number, row: number) {
    const key = cellKey(col, row);
    if (mergedSkip.has(key)) {
      for (const [tl, span] of mergedSpans.entries()) {
        const tlRef = parseCellRef(tl);
        if (!tlRef) continue;
        if (col >= tlRef.col && col < tlRef.col + span.colspan && row >= tlRef.row && row < tlRef.row + span.rowspan) {
          setActiveCell(tl);
          setEditValue(data[tl] || "");
          setEditing(true);
          const style = cellStyles[tl];
          setCellTextColor(style?.color ?? "#000000");
          return;
        }
      }
      return;
    }
    setActiveCell(key);
    setEditValue(data[key] || "");
    setEditing(true);
    const style = cellStyles[key];
    setCellTextColor(style?.color ?? "#000000");
    selectionStartRef.current = { col, row };
  }

  function handleCellBlur() {
    if (activeCell && editValue !== (data[activeCell] ?? "")) {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: { ...s.data, [activeCell!]: editValue },
        cellStyles: editValue.startsWith("=") ? { ...s.cellStyles, [activeCell!]: { color: "#0000ff", bold: s.cellStyles[activeCell!]?.bold ?? false } } : s.cellStyles,
      } : s));
    }
    if (activeCell && !editValue && data[activeCell] !== undefined) {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).filter(([k]) => k !== activeCell)),
      } : s));
    }
    setEditing(false);
  }

  function handleFormulaChange(value: string) {
    setEditValue(value);
  }

  function commitFormulaChange() {
    if (activeCell && editValue !== (data[activeCell] ?? "")) {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: { ...s.data, [activeCell!]: editValue },
        cellStyles: editValue.startsWith("=") ? { ...s.cellStyles, [activeCell!]: { color: "#0000ff", bold: s.cellStyles[activeCell!]?.bold ?? false } } : s.cellStyles,
      } : s));
      if (!editValue) {
        setSheets(prev => prev.map(s => s.id === activeSheetId ? {
          ...s,
          data: Object.fromEntries(Object.entries(s.data).filter(([k]) => k !== activeCell)),
        } : s));
      }
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

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const isCmd = e.metaKey || e.ctrlKey;
    if (isCmd && e.shiftKey && e.key === "z") {
      e.preventDefault();
      redo();
    } else if (isCmd && e.key === "z") {
      e.preventDefault();
      undo();
    } else if (e.key === "Escape") {
      setContextMenu(null);
      setActiveFilterCol(null);
      setShowConditionalFormatting(false);
      setFindReplaceOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

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
    saveState();
    setSheets(prev => prev.map(s => s.id === activeSheetId ? {
      ...s,
      data: (() => {
        const next: Record<string, string> = {};
        for (let c = 0; c < COLS; c++) {
          const cl = COL_LABELS[c]!;
          for (let nr = 0; nr < ROWS; nr++) {
            const or = rowEntries[nr]!.index;
            const src = `${cl}${or + 1}`;
            const dst = `${cl}${nr + 1}`;
            if (s.data[src] !== undefined) next[dst] = s.data[src]!;
          }
        }
        return next;
      })(),
    } : s));
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

  function handleExportXlsx() {
    const wsData: string[][] = [];
    for (let row = 0; row < ROWS; row++) {
      const rowData: string[] = [];
      for (let col = 0; col < COLS; col++) {
        rowData.push(getDisplayValue(cellKey(col, row)));
      }
      wsData.push(rowData);
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeSheet.name);
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spreadsheet.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function mergeSelectedCells() {
    const start = selectionStartRef.current;
    if (!start || !activeCell) return;
    const endRef = parseCellRef(activeCell);
    if (!endRef) return;
    const minCol = Math.min(start.col, endRef.col);
    const maxCol = Math.max(start.col, endRef.col);
    const minRow = Math.min(start.row, endRef.row);
    const maxRow = Math.max(start.row, endRef.row);
    if (minCol === maxCol && minRow === maxRow) return;
    const tl = cellKey(minCol, minRow);
    const br = cellKey(maxCol, maxRow);
    const key = `${tl}:${br}`;
    if (mergedCells.includes(key)) return;
    saveState();
    updateSheet({ mergedCells: [...mergedCells, key] });
  }

  function unmergeSelectedCells() {
    if (!activeCell) return;
    const toRemove = mergedCells.filter(mk => {
      const cells = parseRange(mk);
      return cells.includes(activeCell);
    });
    if (toRemove.length === 0) return;
    saveState();
    updateSheet({ mergedCells: mergedCells.filter(mk => !toRemove.includes(mk)) });
  }

  function findNext() {
    if (!findText) return;
    const allCells: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        allCells.push(cellKey(col, row));
      }
    }
    const matches = allCells.filter(k => getDisplayValue(k).toLowerCase().includes(findText.toLowerCase()));
    setFindMatches(matches);
    if (matches.length === 0) return;
    let idx = findMatchIndex;
    if (matches[idx] === undefined) idx = 0;
    const found = matches[idx];
    if (found) {
      setActiveCell(found);
      const ref = parseCellRef(found);
      if (ref && gridRef.current) {
        const cellEl = gridRef.current.querySelector(`[data-cell="${found}"]`);
        cellEl?.scrollIntoView({ block: "nearest" });
      }
    }
    setFindMatchIndex((idx + 1) % matches.length);
  }

  function replaceCurrent() {
    if (!activeCell || !findText) return;
    const val = getDisplayValue(activeCell);
    if (val.toLowerCase().includes(findText.toLowerCase())) {
      saveState();
      const newVal = val.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), replaceText);
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: { ...s.data, [activeCell!]: data[activeCell!]?.startsWith("=") ? data[activeCell!]! : newVal },
      } : s));
    }
    findNext();
  }

  function replaceAll() {
    if (!findText) return;
    saveState();
    const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    setSheets(prev => prev.map(s => s.id === activeSheetId ? {
      ...s,
      data: Object.fromEntries(
        Object.entries(s.data).map(([k, v]) => {
          if (v.startsWith("=")) return [k, v];
          const disp = computeAllFormulas(s.data)[k] ?? "";
          if (disp.toLowerCase().includes(findText.toLowerCase())) {
            return [k, disp.replace(re, replaceText)];
          }
          return [k, v];
        })
      ),
    } : s));
    setFindMatches([]);
    setFindMatchIndex(0);
  }

  function freezePane(rows: number, cols: number) {
    saveState();
    updateSheet({ frozenRows: rows, frozenCols: cols });
  }

  function unfreezePanes() {
    saveState();
    updateSheet({ frozenRows: 0, frozenCols: 0 });
  }

  function addConditionalRule() {
    if (!cfRange || !cfValue) return;
    saveState();
    let bgColor = "";
    if (cfOperator === "greaterThan") bgColor = "#c8e6c9";
    else if (cfOperator === "lessThan") bgColor = "#ffcdd2";
    else if (cfOperator === "equalTo") bgColor = "#bbdefb";
    else if (cfOperator === "contains") bgColor = "#fff9c4";
    updateSheet({
      conditionalRules: [
        ...conditionalRules,
        {
          range: cfRange,
          type: "cellValue",
          operator: cfOperator,
          value: cfValue,
          style: { bgColor },
        },
      ],
    });
    setCfRange("");
    setCfValue("");
  }

  function removeConditionalRule(index: number) {
    saveState();
    updateSheet({ conditionalRules: conditionalRules.filter((_, i) => i !== index) });
  }

  function toggleFilter() {
    setFilterActive(!filterActive);
    if (filterActive) {
      setActiveFilterCol(null);
      setFilterChecked({});
    }
  }

  function getFilterValues(colLetter: string): string[] {
    const vals = new Set<string>();
    for (let row = 0; row < ROWS; row++) {
      const v = getDisplayValue(`${colLetter}${row + 1}`);
      if (v !== "") vals.add(v);
    }
    return Array.from(vals);
  }

  function toggleFilterValue(col: string, val: string) {
    const current = filterChecked[col];
    if (!current) {
      const all = new Set(getFilterValues(col));
      all.delete(val);
      setFilterChecked(prev => ({ ...prev, [col]: all }));
    } else if (current.has(val)) {
      current.delete(val);
      setFilterChecked(prev => ({ ...prev, [col]: new Set(current) }));
    } else {
      current.add(val);
      setFilterChecked(prev => ({ ...prev, [col]: new Set(current) }));
    }
  }

  function isRowFiltered(row: number): boolean {
    if (!filterActive) return false;
    for (let c = 0; c < COLS; c++) {
      const cl = COL_LABELS[c]!;
      const checked = filterChecked[cl];
      if (!checked || checked.size === 0) continue;
      const val = getDisplayValue(`${cl}${row + 1}`);
      if (!checked.has(val)) return true;
    }
    return false;
  }

  function handleSortFilterCol(ascending: boolean, colLetter: string) {
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
    saveState();
    setSheets(prev => prev.map(s => s.id === activeSheetId ? {
      ...s,
      data: (() => {
        const next: Record<string, string> = {};
        for (let c = 0; c < COLS; c++) {
          const cl = COL_LABELS[c]!;
          for (let nr = 0; nr < ROWS; nr++) {
            const or = rowEntries[nr]!.index;
            if (s.data[`${cl}${or + 1}`] !== undefined) next[`${cl}${nr + 1}`] = s.data[`${cl}${or + 1}`]!;
          }
        }
        return next;
      })(),
    } : s));
    setActiveFilterCol(null);
  }

  function handleContextMenu(e: React.MouseEvent, key: string) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, cellKey: key });
  }

  function doContextAction(action: string) {
    if (!contextMenu) return;
    const ck = contextMenu.cellKey;
    const ref = parseCellRef(ck);
    if (!ref) { setContextMenu(null); return; }

    if (action === "copy") {
      navigator.clipboard.writeText(getDisplayValue(ck));
    } else if (action === "paste") {
      navigator.clipboard.readText().then(text => {
        saveState();
        setSheets(prev => prev.map(s => s.id === activeSheetId ? { ...s, data: { ...s.data, [ck]: text } } : s));
      });
    } else if (action === "cut") {
      navigator.clipboard.writeText(getDisplayValue(ck));
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).filter(([k]) => k !== ck)),
      } : s));
    } else if (action === "clear") {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).filter(([k]) => k !== ck)),
        cellStyles: Object.fromEntries(Object.entries(s.cellStyles).filter(([k]) => k !== ck)),
      } : s));
    } else if (action === "insertRow") {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).map(([k, v]) => {
          const m = k.match(/^([A-Z]+)(\d+)$/);
          if (m) {
            const rowNum = parseInt(m[2]!);
            if (rowNum > ref.row) return [`${m[1]!}${rowNum + 1}`, v];
          }
          return [k, v];
        })),
      } : s));
    } else if (action === "deleteRow") {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).flatMap(([k, v]) => {
          const m = k.match(/^([A-Z]+)(\d+)$/);
          if (m) {
            const rowNum = parseInt(m[2]!);
            if (rowNum === ref.row + 1) return [];
            if (rowNum > ref.row) return [[`${m[1]!}${rowNum - 1}`, v]];
          }
          return [[k, v]];
        })),
      } : s));
    } else if (action === "insertCol") {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).map(([k, v]) => {
          const m = k.match(/^([A-Z]+)(\d+)$/);
          if (m) {
            const colIdx = colToIdx(m[1]!);
            if (colIdx >= ref.col) {
              const newCol = String.fromCharCode(65 + colIdx + 1);
              return [`${newCol}${m[2]!}`, v];
            }
          }
          return [k, v];
        })),
      } : s));
    } else if (action === "deleteCol") {
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: Object.fromEntries(Object.entries(s.data).flatMap(([k, v]) => {
          const m = k.match(/^([A-Z]+)(\d+)$/);
          if (m) {
            const colIdx = colToIdx(m[1]!);
            if (colIdx === ref.col) return [];
            if (colIdx > ref.col) {
              const newCol = String.fromCharCode(65 + colIdx - 1);
              return [[`${newCol}${m[2]!}`, v]];
            }
          }
          return [[k, v]];
        })),
      } : s));
    }
    setContextMenu(null);
  }

  function handleColResizeMouseDown(e: React.MouseEvent, col: number) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[col] ?? COL_WIDTH;
    resizeColRef.current = { col, startX, startWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeColRef.current) return;
      const diff = ev.clientX - resizeColRef.current.startX;
      const newWidth = Math.max(30, resizeColRef.current.startWidth + diff);
      updateSheet({ colWidths: { ...colWidths, [resizeColRef.current.col]: newWidth } });
    };

    const handleMouseUp = () => {
      resizeColRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleRowResizeMouseDown(e: React.MouseEvent, row: number) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = rowHeights[row] ?? ROW_HEIGHT;
    resizeRowRef.current = { row, startY, startHeight };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizeRowRef.current) return;
      const diff = ev.clientY - resizeRowRef.current.startY;
      const newHeight = Math.max(20, resizeRowRef.current.startHeight + diff);
      updateSheet({ rowHeights: { ...rowHeights, [resizeRowRef.current.row]: newHeight } });
    };

    const handleMouseUp = () => {
      resizeRowRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleAutoFillMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    if (!activeCell) return;
    fillRef.current = { startKey: activeCell, isDragging: true };

    const handleMouseMove = () => {};

    const handleMouseUp = (ev: MouseEvent) => {
      if (!fillRef.current.isDragging || !fillRef.current.startKey) {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        return;
      }
      const startRef = parseCellRef(fillRef.current.startKey);
      if (!startRef) { fillRef.current.isDragging = false; return; }
      if (!gridRef.current) { fillRef.current.isDragging = false; return; }
      const gridRect = gridRef.current.getBoundingClientRect();
      const relX = ev.clientX - gridRect.left;
      const relY = ev.clientY - gridRect.top;
      let scrollX = 0;
      let scrollY = 0;
      if (gridRef.current) {
        scrollX = gridRef.current.scrollLeft;
        scrollY = gridRef.current.scrollTop;
      }
      let totalW = 0;
      let endCol = startRef.col;
      for (let c = 0; c < COLS; c++) {
        const w = colWidths[c] ?? COL_WIDTH;
        const visual = totalW + w / 2;
        if (visual > relX + scrollX) { endCol = c; break; }
        totalW += w;
      }
      let totalH = 0;
      let endRow = startRef.row;
      for (let r = 0; r < ROWS; r++) {
        const h = rowHeights[r] ?? ROW_HEIGHT;
        const visual = totalH + h / 2;
        if (visual > relY + scrollY) { endRow = r; break; }
        totalH += h;
      }
      if (endCol === startRef.col && endRow === startRef.row) {
        fillRef.current.isDragging = false;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        return;
      }
      const srcVal = data[fillRef.current.startKey] ?? "";
      const srcNum = Number(srcVal);
      const isNum = !isNaN(srcNum) && srcVal !== "";
      saveState();
      setSheets(prev => prev.map(s => s.id === activeSheetId ? {
        ...s,
        data: (() => {
          const next = { ...s.data };
          const minC = Math.min(startRef.col, endCol);
          const maxC = Math.max(startRef.col, endCol);
          const minR = Math.min(startRef.row, endRow);
          const maxR = Math.max(startRef.row, endRow);
          let counter = 0;
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              if (r === startRef.row && c === startRef.col) continue;
              if (isNum) {
                counter++;
                next[cellKey(c, r)] = String(srcNum + counter);
              } else {
                next[cellKey(c, r)] = srcVal;
              }
            }
          }
          return next;
        })(),
      } : s));
      fillRef.current.isDragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nsheet-sheets");
      if (saved) {
        const parsed = JSON.parse(saved) as Sheet[];
        if (parsed.length > 0) {
          setSheets(parsed);
          setActiveSheetId(parsed[0]!.id);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("nsheet-sheets", JSON.stringify(sheets));
    }, 500);
    return () => clearTimeout(timer);
  }, [sheets]);

  useEffect(() => {
    if (activeCell) {
      setEditValue(data[activeCell] || "");
    } else {
      setEditValue("");
    }
  }, [activeCell]);

  const colHeaderHeight = 28;
  const rowHeaderWidth = 50;

  const freezeExclude = (() => {
    if (frozenRows === 0 && frozenCols === 0) return "";
    return `#grid-container th:nth-child(-n+${frozenCols + 1}),
            #grid-container td:nth-child(-n+${frozenCols + 1}),
            #grid-container tr:nth-child(-n+${frozenRows + 1}) td {
              position: sticky !important;
              z-index: 15;
            }`;
  })();

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
        .find-highlight {
          background: #fff3cd !important;
        }
        .col-resize-handle {
          position: absolute;
          top: 0;
          right: -3px;
          width: 6px;
          height: 100%;
          cursor: col-resize;
          z-index: 5;
        }
        .row-resize-handle {
          position: absolute;
          bottom: -3px;
          left: 0;
          height: 6px;
          width: 100%;
          cursor: row-resize;
          z-index: 5;
        }
        .fill-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 7px;
          height: 7px;
          background: #4c6ef5;
          border: 1px solid white;
          cursor: crosshair;
          z-index: 10;
        }
        #grid-container th, #grid-container td {
          position: relative;
        }
        .filter-arrow {
          display: inline-flex;
          margin-left: 2px;
          cursor: pointer;
          opacity: 0.5;
        }
        .filter-arrow.active {
          opacity: 1;
          color: #4c6ef5;
        }
        .context-menu-item {
          padding: 4px 12px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .context-menu-item:hover {
          background: #e9ecef;
        }
        .dark .context-menu-item:hover {
          background: #373a40;
        }
        .sheet-tab {
          padding: 4px 12px;
          font-size: 12px;
          border-right: 1px solid #dee2e6;
          cursor: pointer;
          white-space: nowrap;
          user-select: none;
        }
        .sheet-tab.active {
          background: white;
          border-bottom: 2px solid #4c6ef5;
        }
        .dark .sheet-tab {
          border-right-color: #373a40;
        }
        .dark .sheet-tab.active {
          background: #25262b;
        }
        ${freezeExclude}
      `}</style>

      <div className="flex items-center gap-1 border-b border-border px-2 py-1 dark:border-border-dark flex-wrap">
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary disabled:opacity-30 dark:hover:bg-surface-dark-secondary"
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary disabled:opacity-30 dark:hover:bg-surface-dark-secondary"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↪
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <span className="text-xs font-medium text-gray-400">fx</span>
        <input
          ref={inputRef}
          className="flex-1 min-w-[120px] rounded border border-border bg-white px-2 py-1 text-sm outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark dark:text-white"
          value={activeCell ? editValue : ""}
          onChange={(e) => handleFormulaChange(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={commitFormulaChange}
          placeholder={activeCell ? activeCell : "Select a cell"}
        />
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Color</label>
          <input
            type="color"
            value={cellTextColor}
            onChange={(e) => {
              const newColor = e.target.value;
              setCellTextColor(newColor);
              if (activeCell) {
                saveState();
                updateSheet({ cellStyles: { ...cellStyles, [activeCell]: { color: newColor, bold: cellStyles[activeCell]?.bold ?? false } } });
              }
            }}
            className="h-5 w-6 cursor-pointer rounded border-0 p-0"
          />
        </div>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={mergeSelectedCells}
          title="Merge selected cells"
        >
          Merge
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={unmergeSelectedCells}
          title="Unmerge selected cells"
        >
          Unmerge
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => freezePane(1, 0)}
          title="Freeze first row"
        >
          Freeze Row
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => freezePane(0, 1)}
          title="Freeze first column"
        >
          Freeze Col
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => freezePane(1, 1)}
          title="Freeze first row and column"
        >
          Freeze Both
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={unfreezePanes}
          title="Unfreeze panes"
        >
          Unfreeze
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => setShowConditionalFormatting(!showConditionalFormatting)}
          title="Conditional formatting"
        >
          Condfmt
        </button>
        <button
          className={`rounded px-1.5 py-1 text-xs font-medium hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary ${filterActive ? "text-brand-600 bg-brand-50" : "text-gray-500"}`}
          onClick={toggleFilter}
          title="Toggle filter"
        >
          Filter
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={handleExportCsv}
          title="Export as CSV"
        >
          CSV
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={handleExportXlsx}
          title="Export as XLSX"
        >
          XLSX
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => handleSort(true)}
          title="Sort A-Z"
        >
          Sort A-Z
        </button>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => handleSort(false)}
          title="Sort Z-A"
        >
          Sort Z-A
        </button>
        <span className="mx-1 text-xs text-gray-300 dark:text-gray-600">|</span>
        <button
          className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
          onClick={() => setFindReplaceOpen(!findReplaceOpen)}
          title="Find & Replace"
        >
          Find
        </button>
        <div className="relative">
          <button
            className="rounded px-1.5 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setShowCheatsheet(!showCheatsheet)}
            title="Formula cheatsheet"
          >
            ?
          </button>
          {showCheatsheet && (
            <>
              <div className="cheatsheet-overlay" onClick={() => setShowCheatsheet(false)} />
              <div className="cheatsheet-panel right-0 top-full mt-1 max-h-96 overflow-y-auto">
                <p className="mb-2 text-xs font-semibold text-gray-500">Formulas</p>
                {Object.entries(FORMULA_FUNCTIONS).filter(([k]) => k === k.toUpperCase() && !["SUM","AVERAGE","MAX","MIN","COUNT","IF","ABS","ROUND","TODAY","LEN","UPPER","LOWER","AND","OR","NOT","CONCAT","TRIM","TEXT","DATE","YEAR","MONTH","DAY","RAND","RANDBETWEEN","MOD","INT","POWER"].includes(k)).map(([name, info]) => (
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
        <div className="ml-auto flex items-center gap-1">
          <button
            className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            AI
          </button>
        </div>
      </div>

      {findReplaceOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-gray-50 px-3 py-1.5 dark:border-border-dark dark:bg-gray-900">
          <input
            className="w-40 rounded border border-border px-2 py-1 text-xs outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark"
            value={findText}
            onChange={e => setFindText(e.target.value)}
            placeholder="Find..."
            onKeyDown={e => { if (e.key === "Enter") findNext(); }}
          />
          <input
            className="w-40 rounded border border-border px-2 py-1 text-xs outline-none focus:border-brand-500 dark:border-border-dark dark:bg-surface-dark"
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            placeholder="Replace..."
            onKeyDown={e => { if (e.key === "Enter") replaceCurrent(); }}
          />
          <span className="text-[10px] text-gray-400">{findMatches.length > 0 ? `${findMatchIndex + 1}/${findMatches.length}` : findText ? "0" : ""}</span>
          <button className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary" onClick={findNext}>Find Next</button>
          <button className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary" onClick={replaceCurrent}>Replace</button>
          <button className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary" onClick={replaceAll}>Replace All</button>
          <button className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary" onClick={() => setFindReplaceOpen(false)}>X</button>
        </div>
      )}

      {showConditionalFormatting && (
        <div className="flex items-center gap-2 border-b border-border bg-gray-50 px-3 py-1.5 flex-wrap dark:border-border-dark dark:bg-gray-900">
          <span className="text-xs font-medium text-gray-500">Condfmt:</span>
          <input
            className="w-24 rounded border border-border px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-dark"
            value={cfRange}
            onChange={e => setCfRange(e.target.value)}
            placeholder="Range e.g. A1:A10"
          />
          <select
            className="rounded border border-border px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-dark"
            value={cfOperator}
            onChange={e => setCfOperator(e.target.value)}
          >
            <option value="greaterThan">&gt;</option>
            <option value="lessThan">&lt;</option>
            <option value="equalTo">=</option>
            <option value="contains">contains</option>
          </select>
          <input
            className="w-20 rounded border border-border px-2 py-1 text-xs dark:border-border-dark dark:bg-surface-dark"
            value={cfValue}
            onChange={e => setCfValue(e.target.value)}
            placeholder="Value"
          />
          <button className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-surface-secondary" onClick={addConditionalRule}>Add</button>
          {conditionalRules.map((r, i) => (
            <span key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
              {r.range} {r.operator} {r.value}
              <button className="text-red-400 hover:text-red-600" onClick={() => removeConditionalRule(i)}>x</button>
            </span>
          ))}
        </div>
      )}

      <div
        id="grid-container"
        ref={gridRef}
        className="flex-1 overflow-auto bg-surface-secondary dark:bg-surface-dark-secondary"
      >
        <table className="border-collapse text-sm" style={{ minWidth: COLS * COL_WIDTH }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 top-0 z-20 bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary"
                style={{ height: colHeaderHeight, width: rowHeaderWidth, minWidth: rowHeaderWidth }}
              />
              {Array.from({ length: COLS }, (_, col) => {
                const cl = COL_LABELS[col]!;
                const w = colWidths[col] ?? COL_WIDTH;
                return (
                  <th
                    key={col}
                    className="sticky top-0 z-10 bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary"
                    style={{
                      height: colHeaderHeight,
                      minWidth: w,
                      width: w,
                      left: frozenCols > 0 && col < frozenCols ? (() => {
                        let left = rowHeaderWidth;
                        for (let i = 0; i < col; i++) left += colWidths[i] ?? COL_WIDTH;
                        return left;
                      })() : undefined,
                      zIndex: frozenCols > 0 && col < frozenCols ? 25 : 10,
                    }}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span>{cl}</span>
                      {filterActive && (
                        <span
                          className={`filter-arrow ${activeFilterCol === cl ? "active" : ""}`}
                          onClick={(e) => { e.stopPropagation(); setActiveFilterCol(activeFilterCol === cl ? null : cl); }}
                        >
                          ▼
                        </span>
                      )}
                    </div>
                    <div
                      className="col-resize-handle"
                      onMouseDown={(e) => handleColResizeMouseDown(e, col)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, row) => {
              if (isRowFiltered(row)) return null;
              const rowH = rowHeights[row] ?? ROW_HEIGHT;
              return (
                <tr key={row}>
                  <td
                    className="sticky left-0 z-10 bg-surface-tertiary text-xs font-medium text-gray-500 dark:bg-surface-dark-tertiary"
                    style={{
                      height: rowH,
                      width: rowHeaderWidth,
                      minWidth: rowHeaderWidth,
                      top: frozenRows > 0 && row < frozenRows ? (() => {
                        let top = colHeaderHeight;
                        for (let i = 0; i < row; i++) top += rowHeights[i] ?? ROW_HEIGHT;
                        return top;
                      })() : undefined,
                      zIndex: frozenRows > 0 && row < frozenRows ? 20 : 10,
                    }}
                  >
                    <div className="relative flex items-center justify-center w-full h-full">
                      <span>{row + 1}</span>
                      <div
                        className="row-resize-handle"
                        onMouseDown={(e) => handleRowResizeMouseDown(e, row)}
                      />
                    </div>
                  </td>
                  {Array.from({ length: COLS }, (_, col) => {
                    const key = cellKey(col, row);
                    if (mergedSkip.has(key)) return null;
                    const span = mergedSpans.get(key);
                    const cw = colWidths[col] ?? COL_WIDTH;
                    const isActive = activeCell === key;
                    const style = cellStyles[key];
                    const cond = condStyles[key];
                    const display = getDisplayValue(key);
                    const isFormula = hasFormula(data[key] || "");
                    const isFindMatch = findText !== "" && display.toLowerCase().includes(findText.toLowerCase());
                    return (
                      <td
                        key={col}
                        data-cell={key}
                        className={`border border-border px-1 text-sm outline-none dark:border-border-dark ${
                          isActive ? "sheet-cell-active" : ""
                        } ${isFindMatch ? "find-highlight" : ""}`}
                        style={{
                          minWidth: cw,
                          width: span ? cw * span.colspan : cw,
                          height: rowH,
                          background: cond?.bgColor ?? "#ffffff",
                          color: style?.color || (isFormula ? "#0000ff" : "#000000"),
                          fontWeight: style?.bold ? "bold" : (cond?.bold ? "bold" : "normal"),
                          left: frozenCols > 0 && col < frozenCols ? (() => {
                            let left = rowHeaderWidth;
                            for (let i = 0; i < col; i++) left += colWidths[i] ?? COL_WIDTH;
                            return left;
                          })() : undefined,
                          top: frozenRows > 0 && row < frozenRows ? (() => {
                            let top = colHeaderHeight;
                            for (let i = 0; i < row; i++) top += rowHeights[i] ?? ROW_HEIGHT;
                            return top;
                          })() : undefined,
                          zIndex: (frozenCols > 0 && col < frozenCols) || (frozenRows > 0 && row < frozenRows) ? 12 : 1,
                        }}
                        colSpan={span?.colspan}
                        rowSpan={span?.rowspan}
                        tabIndex={0}
                        onClick={() => handleCellClick(col, row)}
                        onDoubleClick={() => handleCellClick(col, row)}
                        onKeyDown={(e) => handleKeyDown(e, col, row)}
                        onContextMenu={(e) => handleContextMenu(e, key)}
                      >
                        <div className="relative flex items-center h-full w-full">
                          {isActive && editing ? (
                            <input
                              className="h-full w-full bg-transparent outline-none"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={handleCellBlur}
                              autoFocus
                            />
                          ) : (
                            <span className="truncate block w-full">{display}</span>
                          )}
                          {isActive && !editing && (
                            <div
                              className="fill-handle"
                              onMouseDown={handleAutoFillMouseDown}
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeFormula && (
        <div className="border-t border-border bg-blue-50 px-4 py-1 text-xs text-blue-700 dark:border-border-dark dark:bg-blue-900/20 dark:text-blue-300">
          Formula result: {activeCell ? getDisplayValue(activeCell) : ""}
        </div>
      )}

      <div className="flex items-center border-t border-border bg-surface-tertiary dark:border-border-dark dark:bg-surface-dark-tertiary overflow-x-auto">
        <button
          className="sheet-tab text-gray-500 hover:bg-white dark:hover:bg-gray-700"
          onClick={addSheet}
          title="Add sheet"
        >
          +
        </button>
        {sheets.map(s => (
          <div
            key={s.id}
            className={`sheet-tab ${s.id === activeSheetId ? "active" : "text-gray-500 hover:bg-white dark:hover:bg-gray-700"}`}
            onClick={() => setActiveSheetId(s.id)}
          >
            {sheetRenameId === s.id ? (
              <input
                className="w-20 bg-transparent outline-none border-b border-brand-500 text-xs"
                value={sheetRenameValue}
                onChange={e => setSheetRenameValue(e.target.value)}
                onBlur={finishRenameSheet}
                onKeyDown={e => { if (e.key === "Enter") finishRenameSheet(); }}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => { e.stopPropagation(); startRenameSheet(s.id); }}
              >
                {s.name}
              </span>
            )}
            {sheets.length > 1 && (
              <button
                className="ml-1 text-gray-400 hover:text-red-500 text-[10px]"
                onClick={(e) => { e.stopPropagation(); deleteSheet(s.id); }}
                title="Delete sheet"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-40 rounded border border-border bg-white py-1 shadow-lg dark:border-border-dark dark:bg-gray-800"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {["Copy", "Paste", "Cut", null, "Clear Contents", null, "Insert Row", "Delete Row", "Insert Column", "Delete Column"].map((item, i) =>
              item === null ? (
                <div key={i} className="border-t border-border dark:border-border-dark my-1" />
              ) : (
                <div
                  key={item}
                  className="context-menu-item text-gray-700 dark:text-gray-300"
                  onClick={() => doContextAction(item.toLowerCase().replace(" ", ""))}
                >
                  {item}
                </div>
              )
            )}
          </div>
        </>
      )}

      {activeFilterCol && filterActive && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setActiveFilterCol(null)} />
          <div
            className="fixed z-40 rounded border border-border bg-white py-2 shadow-lg dark:border-border-dark dark:bg-gray-800"
            style={{
              left: Math.min(
                (() => {
                  let left = 0;
                  for (let c = 0; c < COLS; c++) {
                    if (COL_LABELS[c] === activeFilterCol) break;
                    left += colWidths[c] ?? COL_WIDTH;
                  }
                  return left;
                })(),
                window.innerWidth - 200,
              ),
              top: 80,
            }}
          >
            <div className="px-3 pb-1 flex gap-1">
              <button
                className="text-[10px] px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSortFilterCol(true, activeFilterCol)}
              >
                Sort A-Z
              </button>
              <button
                className="text-[10px] px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSortFilterCol(false, activeFilterCol)}
              >
                Sort Z-A
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {getFilterValues(activeFilterCol).map(val => {
                const checked = filterChecked[activeFilterCol];
                const isChecked = !checked || !checked.has(val);
                return (
                  <label key={val} className="flex items-center gap-1 px-3 py-0.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleFilterValue(activeFilterCol, val)}
                    />
                    {val}
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}

      <AISidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} appContext="nSheet Spreadsheet" />
    </div>
  );
}

export { App as default, App };
