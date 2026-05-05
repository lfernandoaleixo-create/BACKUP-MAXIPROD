import { describe, it, expect } from "vitest";

// Test the HighlightText regex logic (same logic used in the frontend component)
function highlightSplit(text: string, search: string): { highlighted: string[]; plain: string[] } {
  if (!search.trim()) return { highlighted: [], plain: [text] };
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  const highlighted: string[] = [];
  const plain: string[] = [];
  parts.forEach((part) => {
    if (regex.test(part)) {
      highlighted.push(part);
    } else {
      plain.push(part);
    }
    // Reset lastIndex since we use 'g' flag
    regex.lastIndex = 0;
  });
  return { highlighted, plain };
}

describe("HighlightText logic", () => {
  it("returns full text as plain when search is empty", () => {
    const result = highlightSplit("Fogos de Artificio", "");
    expect(result.highlighted).toHaveLength(0);
    expect(result.plain).toEqual(["Fogos de Artificio"]);
  });

  it("highlights matching text case-insensitively", () => {
    const result = highlightSplit("Fogos de Artificio", "fogos");
    expect(result.highlighted).toEqual(["Fogos"]);
    expect(result.plain).toContain(""); // before match
    expect(result.plain).toContain(" de Artificio"); // after match
  });

  it("highlights multiple occurrences", () => {
    const result = highlightSplit("ABCABC", "ABC");
    expect(result.highlighted).toEqual(["ABC", "ABC"]);
  });

  it("handles special regex characters in search", () => {
    const result = highlightSplit("Price: $10.00", "$10.00");
    expect(result.highlighted).toEqual(["$10.00"]);
  });

  it("returns full text as plain when no match found", () => {
    const result = highlightSplit("Fogos de Artificio", "xyz");
    expect(result.highlighted).toHaveLength(0);
    expect(result.plain.join("")).toBe("Fogos de Artificio");
  });

  it("highlights partial matches within words", () => {
    const result = highlightSplit("Foguete Espacial", "fogu");
    expect(result.highlighted).toEqual(["Fogu"]);
  });

  it("handles whitespace-only search as empty", () => {
    const result = highlightSplit("Some text", "   ");
    expect(result.highlighted).toHaveLength(0);
    expect(result.plain).toEqual(["Some text"]);
  });
});
