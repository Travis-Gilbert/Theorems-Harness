import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

// Oracle checks for the skills-repair handoff. Each check fails when a retired
// string, an invocation flag, a routing row, or a glossary divergence re-enters
// the `skills/` tree, and names the rule it caught in its failure message.

const skillsRoot = fileURLToPath(new URL("../../skills/", import.meta.url));

async function skillDirs() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort();
}

async function readText(segments) {
  return readFile(join(skillsRoot, ...segments), "utf8");
}

async function skillFiles() {
  const files = [];
  for (const dir of await skillDirs()) {
    for (const entry of await readdir(join(skillsRoot, dir), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) files.push([dir, entry.name]);
    }
  }
  return files;
}

// The autonomy-box quantity terms that die. Mechanical budgets (a research
// token cap, a resident-memory gate) are real and stay, so bare "budget" is
// not retired; only these three unambiguous autonomy-box strings are.
const RETIRED_STRINGS = ["budget clock", "autonomy box", "budget exhaustion"];
const PERMITTED_ENTRIES = ["authority grant", "fill line"];

function entrySpans(text) {
  const lines = text.split("\n");
  const spans = [];
  let current = undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^### (.+)$/);
    if (m) {
      if (current) spans.push(current);
      current = { heading: m[1].toLowerCase(), start: i, end: lines.length };
    } else if (current) {
      current.end = i;
    }
  }
  if (current) spans.push(current);
  return spans;
}

test("retired budget strings appear only in Authority Grant or Fill Line entries", async () => {
  for (const [dir, file] of await skillFiles()) {
    const text = await readText([dir, file]);
    const spans = entrySpans(text);
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase();
      for (const retired of RETIRED_STRINGS) {
        if (!lower.includes(retired)) continue;
        const permitted = spans.some(
          (s) => PERMITTED_ENTRIES.includes(s.heading) && i >= s.start && i < s.end,
        );
        assert.ok(
          permitted,
          `rule: retired budget string "${retired}" outside Authority Grant/Fill Line at ${dir}/${file}:${i + 1}`,
        );
      }
    }
  }
});

test("no skill carries disable-model-invocation", async () => {
  for (const [dir, file] of await skillFiles()) {
    const text = await readText([dir, file]);
    assert.ok(
      !text.includes("disable-model-invocation"),
      `rule: disable-model-invocation flag present at ${dir}/${file}`,
    );
  }
});

test("every routing-table row names a skill directory under skills/", async () => {
  const text = await readText(["theorems-harness", "SKILL.md"]);
  const section = text.match(/## Routing Table\n([\s\S]*?)\n## /)?.[1];
  assert.ok(section, "rule: theorems-harness SKILL.md has no ## Routing Table section");
  const dirs = new Set(await skillDirs());
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    const tokens = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (tokens.length === 0) continue;
    for (const token of tokens) {
      for (const skill of token.split(/\s*\/\s*/)) {
        assert.ok(
          dirs.has(skill),
          `rule: routing row names absent skill "${skill}" (row: ${line.trim()})`,
        );
      }
    }
  }
});

test("glossary copies stay byte-identical and define each term once", async () => {
  const a = await readText(["compute-graph-plans", "GLOSSARY.md"]);
  const b = await readText(["execute-graph-plans", "GLOSSARY.md"]);
  assert.equal(a, b, "rule: the two graph-plan glossary copies diverge");
  const headings = [...a.matchAll(/^### (.+)$/gm)].map((m) => m[1].toLowerCase());
  const seen = new Set();
  for (const heading of headings) {
    assert.ok(
      !seen.has(heading),
      `rule: glossary defines term "${heading}" more than once`,
    );
    seen.add(heading);
  }
});
