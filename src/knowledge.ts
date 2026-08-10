import * as fs from "node:fs/promises";
import * as path from "node:path";

/** Extensions we treat as readable knowledge. Anything else is skipped. */
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".html",
  ".htm",
  ".puml",
  ".plantuml",
  ".log",
  ".rst",
]);

/** Directories never worth walking into. */
const SKIP_DIRS = new Set([".git", "node_modules", ".DS_Store"]);

export interface KnowledgeDoc {
  /** Path relative to the root it was found in. */
  relPath: string;
  absPath: string;
  content: string;
  modified: string;
}

export interface GatherOptions {
  /** Case-insensitive substring; when set, only matching files are returned. */
  query?: string;
  /** Total budget across all documents. Collection stops once exceeded. */
  maxBytes?: number;
}

export interface GatherResult {
  docs: KnowledgeDoc[];
  /** Files skipped because they are binary or an unsupported type. */
  skipped: string[];
  /** True when maxBytes cut the collection short. */
  truncated: boolean;
}

/**
 * Walks the allowed roots and collects every readable text document,
 * optionally filtered by a substring query against the path and content.
 */
export async function gatherKnowledge(
  roots: string[],
  options: GatherOptions = {}
): Promise<GatherResult> {
  const { query, maxBytes = 100_000 } = options;
  const needle = query?.toLowerCase();

  const docs: KnowledgeDoc[] = [];
  const skipped: string[] = [];
  let used = 0;
  let truncated = false;

  const walk = async (dir: string, root: string): Promise<void> => {
    if (truncated) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — nothing to contribute
    }

    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full, root);
        continue;
      }
      if (!entry.isFile()) continue;

      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        skipped.push(path.relative(root, full));
        continue;
      }

      let buffer: Buffer;
      let modified: string;
      try {
        buffer = await fs.readFile(full);
        modified = (await fs.stat(full)).mtime.toISOString();
      } catch {
        skipped.push(path.relative(root, full));
        continue;
      }

      // A null byte means it is binary despite the extension.
      if (buffer.includes(0)) {
        skipped.push(path.relative(root, full));
        continue;
      }

      const content = buffer.toString("utf8");
      const relPath = path.relative(root, full);

      if (
        needle &&
        !relPath.toLowerCase().includes(needle) &&
        !content.toLowerCase().includes(needle)
      ) {
        continue;
      }

      if (used + buffer.length > maxBytes) {
        truncated = true;
        return;
      }

      used += buffer.length;
      docs.push({ relPath, absPath: full, content, modified });
    }
  };

  for (const root of roots) {
    await walk(root, root);
  }

  docs.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { docs, skipped, truncated };
}

/** Renders the collected documents as one Markdown document. */
export function renderMarkdown(result: GatherResult): string {
  if (result.docs.length === 0) {
    return "_No matching documents found in the file store._";
  }

  const sections = result.docs.map(
    (doc) => `## ${doc.relPath}\n\n_Last modified: ${doc.modified}_\n\n${doc.content.trim()}`
  );

  let out = `# Knowledge from the file store\n\n${sections.join("\n\n---\n\n")}`;
  if (result.truncated) {
    out += "\n\n---\n\n_Output truncated: byte budget reached. Narrow with `query` or raise `max_bytes`._";
  }
  return out;
}

// ---- PlantUML ----

const UML_BLOCK = /@startuml[\s\S]*?@enduml/gi;
const UML_FENCE = /```(?:plantuml|puml)\s*\n([\s\S]*?)```/gi;
/** "Alice -> Bob: message" style sequence lines. */
const ARROW_LINE = /^\s*([\w .'"-]+?)\s*(-{1,2}>{1,2}|-->|->)\s*([\w .'"-]+?)\s*(?::\s*(.+))?$/;
/** "1. Do the thing" / "Step 2: do the thing" style ordered steps. */
const STEP_LINE = /^\s*(?:step\s+)?(\d+)[.):]\s+(.{3,120})$/i;

export interface FlowSource {
  relPath: string;
  /** How the diagram was obtained. */
  origin: "embedded" | "sequence" | "steps";
  uml: string;
}

/**
 * Pulls PlantUML out of a document. Existing @startuml blocks and
 * ```plantuml fences are passed through untouched; otherwise a diagram is
 * derived from arrow lines or numbered steps if the document has any.
 */
export function extractFlows(doc: KnowledgeDoc): FlowSource[] {
  const flows: FlowSource[] = [];

  for (const match of doc.content.matchAll(UML_BLOCK)) {
    flows.push({ relPath: doc.relPath, origin: "embedded", uml: match[0].trim() });
  }

  for (const match of doc.content.matchAll(UML_FENCE)) {
    const body = match[1].trim();
    // Skip fences already captured above as @startuml blocks.
    if (/@startuml/i.test(body)) continue;
    flows.push({
      relPath: doc.relPath,
      origin: "embedded",
      uml: `@startuml\n${body}\n@enduml`,
    });
  }

  if (flows.length > 0) return flows;

  const lines = doc.content.split("\n");

  const arrows = lines
    .map((line) => line.match(ARROW_LINE))
    .filter((m): m is RegExpMatchArray => m !== null)
    // Markdown tables and code lines produce false positives; require plain words.
    .filter((m) => !m[0].includes("|") && !m[0].trim().startsWith("#"));

  if (arrows.length >= 2) {
    const body = arrows
      .map((m) => {
        const from = quoteParticipant(m[1]);
        const to = quoteParticipant(m[3]);
        const label = m[4] ? `: ${m[4].trim()}` : "";
        // Keep the author's arrow style — "-->" is a dashed reply in PlantUML.
        const arrow = m[2].startsWith("--") ? "-->" : "->";
        return `${from} ${arrow} ${to}${label}`;
      })
      .join("\n");
    flows.push({
      relPath: doc.relPath,
      origin: "sequence",
      uml: `@startuml\ntitle ${doc.relPath}\n${body}\n@enduml`,
    });
    return flows;
  }

  const steps = lines
    .map((line) => line.match(STEP_LINE))
    .filter((m): m is RegExpMatchArray => m !== null);

  if (steps.length >= 2) {
    const body = steps.map((m) => `:${m[2].trim().replace(/;/g, ",")};`).join("\n");
    flows.push({
      relPath: doc.relPath,
      origin: "steps",
      uml: `@startuml\ntitle ${doc.relPath}\nstart\n${body}\nstop\n@enduml`,
    });
  }

  return flows;
}

/** PlantUML participant names need quoting once they contain spaces. */
function quoteParticipant(name: string): string {
  const clean = name.trim().replace(/"/g, "");
  return /\s/.test(clean) ? `"${clean}"` : clean;
}

/** Renders every flow found across the collected documents. */
export function renderPlantUml(result: GatherResult): string {
  const flows = result.docs.flatMap((doc) => extractFlows(doc));

  if (flows.length === 0) {
    return (
      "_No flow found in the file store._\n\n" +
      "Nothing in the matching documents contained a PlantUML block, a\n" +
      "sequence of `A -> B` lines, or numbered steps. Call this tool with\n" +
      "`format: \"markdown\"` to read the content and author a diagram from it."
    );
  }

  const blocks = flows.map(
    (flow) => `### ${flow.relPath} (${flow.origin})\n\n\`\`\`plantuml\n${flow.uml}\n\`\`\``
  );
  return `# Flows found in the file store\n\n${blocks.join("\n\n")}`;
}

/**
 * Markdown by default, PlantUML when the content actually describes a flow —
 * the "auto" behaviour. Returns both when flows are present so the caller
 * keeps the surrounding context.
 */
export function renderAuto(result: GatherResult): string {
  const hasFlow = result.docs.some((doc) => extractFlows(doc).length > 0);
  if (!hasFlow) return renderMarkdown(result);
  return `${renderPlantUml(result)}\n\n---\n\n${renderMarkdown(result)}`;
}
