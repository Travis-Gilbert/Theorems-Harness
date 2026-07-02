import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".harness",
  ".next",
  ".parcel-cache",
  ".turbo",
  ".venv",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
]);
const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_FILES = 1_500;
const DEFAULT_MAX_FILE_BYTES = 1_500_000;
const DEFAULT_MAX_TOTAL_BYTES = 18_000_000;
const DEFAULT_CONTEXT_LINES = 2;
const DEFAULT_CHUNK_LINES = 48;
const DEFAULT_CHUNK_OVERLAP = 8;
const MAX_LIMIT = 500;
const MAX_CONTEXT_LINES = 10;
const MAX_CHUNK_LINES = 120;
const MAX_PATTERN_LENGTH = 4_000;
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

export async function queryGrep(input = {}, options = {}) {
  const productTool = options.productTool ?? "grep";
  const query = searchText(input);
  if (!query) {
    return degraded(productTool, "empty_query", {
      message: `${productTool} requires a non-empty query or pattern.`,
    });
  }
  if (query.length > MAX_PATTERN_LENGTH) {
    return degraded(productTool, "pattern_too_large", {
      message: `${productTool} patterns are capped at ${MAX_PATTERN_LENGTH} characters.`,
    });
  }

  const root = resolveRoot(input);
  const config = searchConfig(input, root);
  const matcher = buildMatcher(query, config);
  if (!matcher.ok) {
    return degraded(productTool, "invalid_pattern", {
      error: matcher.error,
      pattern: query,
    });
  }

  const collection = await collectFiles(root, config);
  if (!collection.ok) {
    return degraded(productTool, collection.reason, collection);
  }

  const results = [];
  const matchedFiles = new Set();
  const counts = {
    files_scanned: 0,
    files_matched: 0,
    matches_seen: 0,
    matches_returned: 0,
    files_skipped_binary: 0,
    files_skipped_large: collection.skipped_large,
    files_skipped_unreadable: collection.skipped_unreadable,
    files_omitted_by_limit: collection.omitted_by_limit,
  };
  let totalBytes = 0;

  for (const file of collection.files) {
    if (results.length >= config.limit) break;
    if (file.bytes > config.maxFileBytes) continue;
    if (totalBytes + file.bytes > config.maxTotalBytes) break;

    const buffer = await readFile(file.absolute_path).catch(() => null);
    if (!buffer) {
      counts.files_skipped_unreadable += 1;
      continue;
    }
    totalBytes += buffer.byteLength;
    if (isProbablyBinary(buffer)) {
      counts.files_skipped_binary += 1;
      continue;
    }

    counts.files_scanned += 1;
    const text = buffer.toString("utf8");
    const lines = splitLines(text);
    for (let index = 0; index < lines.length; index += 1) {
      const match = matcher.match(lines[index]);
      if (!match) continue;
      counts.matches_seen += 1;
      matchedFiles.add(file.relative_path);
      if (results.length >= config.limit) continue;
      results.push(toLineResult({
        file,
        lines,
        lineIndex: index,
        column: match.column,
        matchText: match.text,
        contextLines: config.contextLines,
      }));
    }
  }

  counts.files_matched = matchedFiles.size;
  counts.matches_returned = results.length;

  return {
    schema_version: 1,
    ok: true,
    status: "ok",
    product_tool: productTool,
    mode: config.regex ? "regex" : "literal",
    backend: "local-files",
    query,
    root,
    results,
    counts,
    limits: {
      limit: config.limit,
      context_lines: config.contextLines,
      max_files: config.maxFiles,
      max_file_bytes: config.maxFileBytes,
      max_total_bytes: config.maxTotalBytes,
    },
    formatting: {
      style: "code-neighborhood",
      note: "Each result includes the nearest symbol plus before/after context lines.",
    },
  };
}

export async function querySemanticGrep(input = {}, options = {}) {
  const productTool = options.productTool ?? "semantic_grep";
  const query = searchText(input);
  if (!query) {
    return degraded(productTool, "empty_query", {
      message: `${productTool} requires a non-empty query or pattern.`,
    });
  }

  const root = resolveRoot(input);
  const config = {
    ...searchConfig(input, root),
    chunkLines: clampPositive(input.chunk_lines ?? input.chunkLines, DEFAULT_CHUNK_LINES, MAX_CHUNK_LINES),
    chunkOverlap: clampPositive(input.chunk_overlap ?? input.chunkOverlap, DEFAULT_CHUNK_OVERLAP, MAX_CHUNK_LINES),
  };
  const collection = await collectFiles(root, config);
  if (!collection.ok) {
    return degraded(productTool, collection.reason, collection);
  }

  const queryTokens = significantTokens(query);
  if (!queryTokens.length) {
    return degraded(productTool, "empty_query", {
      message: `${productTool} could not extract searchable terms from the query.`,
    });
  }

  const candidates = [];
  const counts = {
    files_scanned: 0,
    chunks_scored: 0,
    chunks_returned: 0,
    files_skipped_binary: 0,
    files_skipped_large: collection.skipped_large,
    files_skipped_unreadable: collection.skipped_unreadable,
    files_omitted_by_limit: collection.omitted_by_limit,
  };
  let totalBytes = 0;

  for (const file of collection.files) {
    if (file.bytes > config.maxFileBytes) continue;
    if (totalBytes + file.bytes > config.maxTotalBytes) break;

    const buffer = await readFile(file.absolute_path).catch(() => null);
    if (!buffer) {
      counts.files_skipped_unreadable += 1;
      continue;
    }
    totalBytes += buffer.byteLength;
    if (isProbablyBinary(buffer)) {
      counts.files_skipped_binary += 1;
      continue;
    }

    counts.files_scanned += 1;
    const lines = splitLines(buffer.toString("utf8"));
    for (const chunk of chunkLines(lines, config.chunkLines, config.chunkOverlap)) {
      const scored = scoreChunk({ query, queryTokens, file, lines, chunk });
      counts.chunks_scored += 1;
      if (scored.score > 0) candidates.push(scored);
    }
  }

  const results = candidates
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, config.limit)
    .map((candidate, index) => ({
      rank: index + 1,
      path: candidate.path,
      absolute_path: candidate.absolute_path,
      line_start: candidate.line_start,
      line_end: candidate.line_end,
      symbol: candidate.symbol,
      score: Number(candidate.score.toFixed(4)),
      rank_signals: candidate.rank_signals,
      snippet: candidate.snippet,
    }));
  counts.chunks_returned = results.length;

  return {
    schema_version: 1,
    ok: true,
    status: "ok",
    product_tool: productTool,
    mode: "hybrid",
    backend: "local-hybrid-lexical",
    query,
    root,
    results,
    counts,
    limits: {
      limit: config.limit,
      chunk_lines: config.chunkLines,
      chunk_overlap: config.chunkOverlap,
      max_files: config.maxFiles,
      max_file_bytes: config.maxFileBytes,
      max_total_bytes: config.maxTotalBytes,
    },
    formatting: {
      style: "ranked-code-neighborhood",
      note: "Local ranking uses term overlap, phrase, path, and symbol boosts. Native embedding or graph search can be layered behind the same tool shape.",
    },
  };
}

function searchConfig(input, root) {
  return {
    root,
    searchPaths: searchPaths(input, root),
    includes: patternList(input.include ?? input.includes ?? input.glob ?? input.globs ?? input.path_glob ?? input.pathGlob),
    excludes: patternList(input.exclude ?? input.excludes),
    extensions: extensionList(input.extension ?? input.extensions ?? input.file_extension ?? input.fileExtensions),
    ignoredDirs: ignoredDirs(input),
    regex: Boolean(input.regex),
    caseSensitive: Boolean(input.case_sensitive ?? input.caseSensitive),
    contextLines: clampPositive(input.context_lines ?? input.contextLines, DEFAULT_CONTEXT_LINES, MAX_CONTEXT_LINES),
    limit: clampPositive(input.limit ?? input.max_results ?? input.maxResults, DEFAULT_LIMIT, MAX_LIMIT),
    maxFiles: clampPositive(input.max_files ?? input.maxFiles, DEFAULT_MAX_FILES, 25_000),
    maxFileBytes: clampPositive(input.max_file_bytes ?? input.maxFileBytes, DEFAULT_MAX_FILE_BYTES, 20_000_000),
    maxTotalBytes: clampPositive(input.max_total_bytes ?? input.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES, 200_000_000),
  };
}

function resolveRoot(input) {
  return resolve(String(input.cwd ?? input.root ?? input.local_path ?? input.localPath ?? process.cwd()));
}

function searchPaths(input, root) {
  const values = list(input.paths ?? input.path ?? input.files ?? input.file ?? input.path_prefix ?? input.pathPrefix);
  if (!values.length) return [root];
  return values.map((value) => resolve(root, value));
}

async function collectFiles(root, config) {
  const state = {
    files: [],
    skipped_large: 0,
    skipped_unreadable: 0,
    omitted_by_limit: 0,
  };

  for (const searchPath of config.searchPaths) {
    await walkPath(searchPath, root, config, state);
  }

  state.files.sort((left, right) => left.relative_path.localeCompare(right.relative_path));
  return {
    ok: true,
    reason: "",
    files: state.files,
    skipped_large: state.skipped_large,
    skipped_unreadable: state.skipped_unreadable,
    omitted_by_limit: state.omitted_by_limit,
  };
}

async function walkPath(absolutePath, root, config, state) {
  if (state.files.length >= config.maxFiles) {
    state.omitted_by_limit += 1;
    return;
  }

  const info = await lstat(absolutePath).catch(() => null);
  if (!info) {
    state.skipped_unreadable += 1;
    return;
  }
  if (info.isSymbolicLink()) return;

  const relativePath = displayPath(root, absolutePath);
  if (info.isDirectory()) {
    if (shouldIgnoreDirectory(relativePath, absolutePath, config)) return;
    const entries = await readdir(absolutePath).catch(() => null);
    if (!entries) {
      state.skipped_unreadable += 1;
      return;
    }
    for (const entry of entries.sort()) {
      await walkPath(resolve(absolutePath, entry), root, config, state);
      if (state.files.length >= config.maxFiles) {
        state.omitted_by_limit += 1;
        break;
      }
    }
    return;
  }

  if (!info.isFile()) return;
  if (info.size > config.maxFileBytes) {
    state.skipped_large += 1;
    return;
  }
  if (!pathAllowed(relativePath, config)) return;

  state.files.push({
    absolute_path: absolutePath,
    relative_path: relativePath,
    bytes: info.size,
  });
}

function shouldIgnoreDirectory(relativePath, absolutePath, config) {
  const name = basename(absolutePath);
  if (config.ignoredDirs.has(name)) return true;
  return config.excludes.some((pattern) => matchesPattern(relativePath, pattern));
}

function pathAllowed(relativePath, config) {
  if (config.extensions.length && !config.extensions.some((extension) => relativePath.endsWith(extension))) {
    return false;
  }
  if (config.includes.length && !config.includes.some((pattern) => matchesPattern(relativePath, pattern))) {
    return false;
  }
  return !config.excludes.some((pattern) => matchesPattern(relativePath, pattern));
}

function buildMatcher(pattern, config) {
  if (config.regex) {
    try {
      const flags = config.caseSensitive ? "g" : "gi";
      const expression = new RegExp(pattern, flags);
      return {
        ok: true,
        match(line) {
          expression.lastIndex = 0;
          const match = expression.exec(line);
          if (!match) return null;
          return {
            column: match.index + 1,
            text: match[0],
          };
        },
      };
    } catch (caught) {
      return { ok: false, error: caught instanceof Error ? caught.message : String(caught) };
    }
  }

  const needle = config.caseSensitive ? pattern : pattern.toLowerCase();
  return {
    ok: true,
    match(line) {
      const haystack = config.caseSensitive ? line : line.toLowerCase();
      const index = haystack.indexOf(needle);
      if (index === -1) return null;
      return {
        column: index + 1,
        text: line.slice(index, index + pattern.length),
      };
    },
  };
}

function toLineResult({ file, lines, lineIndex, column, matchText, contextLines }) {
  const before = contextSlice(lines, Math.max(0, lineIndex - contextLines), lineIndex);
  const after = contextSlice(lines, lineIndex + 1, Math.min(lines.length, lineIndex + contextLines + 1));
  const line = {
    number: lineIndex + 1,
    text: truncateLine(lines[lineIndex]),
  };
  return {
    path: file.relative_path,
    absolute_path: file.absolute_path,
    line_number: lineIndex + 1,
    column,
    match: truncateLine(matchText, 240),
    symbol: nearestSymbol(lines, lineIndex),
    context: {
      before,
      line,
      after,
    },
    excerpt: renderExcerpt([...before, line, ...after], line.number),
  };
}

function scoreChunk({ query, queryTokens, file, lines, chunk }) {
  const chunkLinesValue = lines.slice(chunk.start, chunk.end);
  const text = chunkLinesValue.join("\n");
  const lowerText = text.toLowerCase();
  const pathLower = file.relative_path.toLowerCase();
  const symbol = nearestSymbol(lines, chunk.start) ?? nearestSymbol(lines, chunk.end - 1);
  const symbolLower = String(symbol ?? "").toLowerCase();
  const tokenCounts = countTokens(lowerText);
  const matchedTerms = [];
  let termScore = 0;
  let pathBoost = 0;
  let symbolBoost = 0;

  for (const token of queryTokens) {
    const count = tokenCounts.get(token) ?? 0;
    if (count > 0) {
      matchedTerms.push(token);
      termScore += Math.log1p(count) * (token.length >= 6 ? 1.35 : 1);
    }
    if (pathLower.includes(token)) pathBoost += 0.75;
    if (symbolLower.includes(token)) symbolBoost += 1.1;
  }

  const phraseBoost = lowerText.includes(query.toLowerCase()) ? 3 : 0;
  const densityPenalty = Math.log2(Math.max(12, tokenize(lowerText).length));
  const score = (termScore + pathBoost + symbolBoost + phraseBoost) / densityPenalty;

  return {
    path: file.relative_path,
    absolute_path: file.absolute_path,
    line_start: chunk.start + 1,
    line_end: chunk.end,
    symbol,
    score,
    rank_signals: {
      matched_terms: matchedTerms,
      term_score: Number(termScore.toFixed(4)),
      phrase_boost: phraseBoost,
      path_boost: Number(pathBoost.toFixed(4)),
      symbol_boost: Number(symbolBoost.toFixed(4)),
    },
    snippet: renderExcerpt(contextSlice(lines, chunk.start, chunk.end, 180), chunk.start + 1),
  };
}

function chunkLines(lines, chunkLinesValue, overlapValue) {
  if (!lines.length) return [];
  const size = Math.max(8, chunkLinesValue);
  const overlap = Math.min(Math.max(0, overlapValue), size - 1);
  const chunks = [];
  for (let start = 0; start < lines.length; start += size - overlap) {
    const end = Math.min(lines.length, start + size);
    chunks.push({ start, end });
    if (end >= lines.length) break;
  }
  return chunks;
}

function contextSlice(lines, start, end, maxChars = 320) {
  return lines.slice(start, end).map((text, offset) => ({
    number: start + offset + 1,
    text: truncateLine(text, maxChars),
  }));
}

function renderExcerpt(lines, focusLine) {
  return lines
    .map((line) => `${line.number === focusLine ? ">" : " "} ${String(line.number).padStart(4, " ")} | ${line.text}`)
    .join("\n");
}

function nearestSymbol(lines, lineIndex) {
  const start = Math.max(0, lineIndex - 90);
  for (let index = lineIndex; index >= start; index -= 1) {
    const text = lines[index]?.trim() ?? "";
    if (!text) continue;
    const symbol = symbolFromLine(text);
    if (symbol) return symbol;
  }
  return null;
}

function symbolFromLine(text) {
  const patterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
    /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
    /^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/,
    /^(?:pub\s+)?struct\s+([A-Za-z_][\w]*)/,
    /^impl(?:<[^>]+>)?\s+([A-Za-z_][\w:]*)/,
    /^def\s+([A-Za-z_][\w]*)/,
    /^class\s+([A-Za-z_][\w]*)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `${match[1]}: ${truncateLine(text, 180)}`;
  }
  return null;
}

function significantTokens(text) {
  const tokens = tokenize(text).filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  return [...new Set(tokens)].slice(0, 40);
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_$-]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countTokens(text) {
  const counts = new Map();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function searchText(input) {
  return String(input.query ?? input.pattern ?? input.text ?? input.q ?? "").trim();
}

function ignoredDirs(input) {
  const dirs = new Set(DEFAULT_IGNORED_DIRS);
  for (const item of list(input.ignore_dir ?? input.ignore_dirs ?? input.ignored_dirs ?? input.ignoredDirs)) {
    if (item) dirs.add(item);
  }
  return dirs;
}

function extensionList(value) {
  return list(value).map((item) => item.startsWith(".") ? item : `.${item}`);
}

function patternList(value) {
  return list(value).filter(Boolean);
}

function list(value) {
  if (Array.isArray(value)) return value.flatMap((item) => list(item));
  if (typeof value === "string") {
    return value
      .split(/[\n,]/u)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value == null ? [] : [String(value)];
}

function matchesPattern(path, pattern) {
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedPattern = String(pattern).replaceAll("\\", "/");
  if (!normalizedPattern.includes("*")) {
    return normalizedPath.includes(normalizedPattern);
  }
  const expression = new RegExp(`^${escapeRegex(normalizedPattern).replaceAll("\\*", ".*")}$`);
  return expression.test(normalizedPath);
}

function displayPath(root, absolutePath) {
  const path = relative(root, absolutePath).replaceAll("\\", "/");
  if (!path || path === "") return ".";
  return path.startsWith("..") ? absolutePath : path;
}

function isProbablyBinary(buffer) {
  const length = Math.min(buffer.byteLength, 8_000);
  for (let index = 0; index < length; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function splitLines(text) {
  return String(text).replace(/\r\n/gu, "\n").split("\n");
}

function truncateLine(text, max = 320) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function clampPositive(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), max);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function degraded(productTool, reason, extra = {}) {
  return {
    schema_version: 1,
    ok: false,
    status: "degraded",
    product_tool: productTool,
    reason,
    ...extra,
  };
}
