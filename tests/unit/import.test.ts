import { describe, expect, it } from "vitest";

import {
  cleanDescription,
  detectColumns,
  importId,
  parseAmount,
  parseCsv,
  parseStatementDate,
  statementToRows,
} from "@/lib/import/csv";

describe("parseCsv", () => {
  it("handles quotes, commas in fields, CRLF and BOM", () => {
    const rows = parseCsv('﻿Date,Description,Amount\r\n01/10/2026,"AEON, Mid Valley",-45.90\r\n02/10/2026,"He said ""hi""",-1.00\r\n');
    expect(rows).toEqual([
      ["Date", "Description", "Amount"],
      ["01/10/2026", "AEON, Mid Valley", "-45.90"],
      ["02/10/2026", 'He said "hi"', "-1.00"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("statement fields", () => {
  it("parses dates day-first by default", () => {
    expect(parseStatementDate("05/10/2026")).toBe("2026-10-05");
    expect(parseStatementDate("05/10/2026", true)).toBe("2026-05-10");
    expect(parseStatementDate("2026-10-05 13:22")).toBe("2026-10-05");
    expect(parseStatementDate("5 Okt 2026")).toBe("2026-10-05");
    expect(parseStatementDate("nope")).toBeNull();
  });

  it("parses signed and formatted amounts", () => {
    expect(parseAmount("RM1,234.50")).toBe(1234.5);
    expect(parseAmount("-12.30")).toBe(-12.3);
    expect(parseAmount("(45.00)")).toBe(-45);
    expect(parseAmount("12.30 DR")).toBe(-12.3);
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("")).toBeNull();
  });

  it("cleans bank descriptions", () => {
    expect(cleanDescription("POS DEBIT 123456 AEON BIG KL")).toBe("AEON Big KL");
    expect(cleanDescription("DuitNow Transfer Ali Bin Abu")).toBe("Ali Bin Abu");
  });
});

describe("statementToRows", () => {
  it("keeps only money out from a signed-amount export", () => {
    const rows = parseCsv(
      "Transaction Date,Description,Amount\n01/10/2026,GRAB*RIDE 8877,-18.50\n02/10/2026,SALARY,5000.00\n03/10/2026,Jaya Grocer,-142.35",
    );
    const map = detectColumns(rows[0]);
    expect(map).toMatchObject({ date: 0, description: 1, amount: 2 });
    const out = statementToRows(rows, map);
    expect(out.map((r) => [r.date, r.amount, r.category])).toEqual([
      ["2026-10-01", 18.5, "Transport"],
      ["2026-10-03", 142.35, "Groceries"],
    ]);
  });

  it("uses the debit column when there is one", () => {
    const rows = parseCsv("Date,Details,Debit,Credit\n01/10/2026,TNB BILL,87.20,\n02/10/2026,REFUND,,10.00");
    const out = statementToRows(rows, detectColumns(rows[0]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ amount: 87.2, category: "Utilities" });
  });

  it("gives repeat imports the same ids, and same-day duplicates different ones", async () => {
    const rows = parseCsv("Date,Description,Amount\n01/10/2026,Kopi,-2.80\n01/10/2026,Kopi,-2.80");
    const out = statementToRows(rows, detectColumns(rows[0]));
    expect(out).toHaveLength(2);
    const ids = await Promise.all(out.map((r) => importId(r.key)));
    expect(ids[0]).not.toBe(ids[1]);
    expect(await importId(out[0].key)).toBe(ids[0]);
  });
});
