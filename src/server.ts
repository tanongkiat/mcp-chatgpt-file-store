import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  appendFileContents,
  createDirectory,
  deleteEntry,
  ensureDir,
  getDefaultRoots,
  getFileInfo,
  listDirectory,
  moveEntry,
  readFileContents,
  resolveInRoot,
  searchFiles,
  writeFileContents,
} from "./filesystem.js";
import {
  gatherKnowledge,
  renderAuto,
  renderMarkdown,
  renderPlantUml,
} from "./knowledge.js";

export function createFileStoreServer(): McpServer {
  const roots = getDefaultRoots();

  // Ensure all root folders exist at startup.
  for (const root of roots) {
    ensureDir(root).catch((err) => {
      console.error(`[mcp-chatgpt-file-store] Could not create root ${root}:`, err);
    });
  }

  const server = new McpServer(
    {
      name: "chatgpt-file-store",
      version: "0.1.0",
    },
    {
      instructions:
        "Sandboxed local file store. All paths must stay inside the allowed directories. " +
        "Relative paths are resolved against the first allowed directory. " +
        "Use list_allowed_directories to see where you can write.",
    }
  );

  // ---- Read-only tools ----

  server.registerTool(
    "list_allowed_directories",
    {
      title: "List allowed directories",
      description:
        "Returns the directories ChatGPT is allowed to read from and write to. Call this first.",
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ allowedDirectories: roots }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_directory",
    {
      title: "List directory contents",
      description:
        "Lists files and folders inside a directory within the allowed store.",
      inputSchema: {
        path: z.string().describe("Directory path inside the file store"),
      },
    },
    async ({ path: inputPath }) => {
      const abs = resolveInRoot(roots, inputPath);
      const entries = await listDirectory(abs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                directory: abs,
                entries: entries.map((e) => ({
                  name: e.name,
                  type: e.type,
                  size: e.size,
                  modified: e.modified,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "read_file",
    {
      title: "Read file",
      description:
        "Reads the full contents of a text file inside the allowed file store.",
      inputSchema: {
        path: z.string().describe("File path inside the file store"),
      },
    },
    async ({ path: inputPath }) => {
      const abs = resolveInRoot(roots, inputPath);
      const result = await readFileContents(abs);
      return {
        content: [{ type: "text", text: result.content }],
      };
    }
  );

  server.registerTool(
    "get_file_info",
    {
      title: "Get file info",
      description: "Returns metadata (size, modified time, permissions) for a path.",
      inputSchema: {
        path: z.string().describe("Path inside the file store"),
      },
    },
    async ({ path: inputPath }) => {
      const abs = resolveInRoot(roots, inputPath);
      const info = await getFileInfo(abs);
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }
  );

  server.registerTool(
    "search_files",
    {
      title: "Search files",
      description:
        "Searches the file store for files matching a pattern (supports * and ?).",
      inputSchema: {
        path: z.string().describe("Directory to search inside"),
        pattern: z.string().describe("Glob pattern, e.g. *.md or *notes*"),
        recursive: z
          .boolean()
          .optional()
          .describe("Search subdirectories (default true)"),
      },
    },
    async ({ path: inputPath, pattern, recursive = true }) => {
      const abs = resolveInRoot(roots, inputPath);
      const matches = await searchFiles(abs, pattern, recursive);
      return {
        content: [{ type: "text", text: JSON.stringify({ matches }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_knowledge",
    {
      title: "Get knowledge from the store",
      description:
        "Reads the documents in the file store and returns them as one body of knowledge. " +
        "Returns Markdown, or PlantUML when the content describes a flow — existing " +
        "@startuml blocks are passed through, and diagrams are derived from 'A -> B' " +
        "lines or numbered steps. Use this to ground an answer on everything stored, " +
        "instead of reading files one at a time.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Only include documents whose path or content contains this text"),
        format: z
          .enum(["auto", "markdown", "plantuml"])
          .optional()
          .describe(
            "auto (default): Markdown, plus PlantUML when a flow is present. " +
              "markdown: content only. plantuml: diagrams only."
          ),
        max_bytes: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Byte budget across all documents (default 100000)"),
      },
    },
    async ({ query, format = "auto", max_bytes: maxBytes }) => {
      const result = await gatherKnowledge(roots, { query, maxBytes });
      const text =
        format === "markdown"
          ? renderMarkdown(result)
          : format === "plantuml"
            ? renderPlantUml(result)
            : renderAuto(result);

      return { content: [{ type: "text", text }] };
    }
  );

  // ---- Write tools ----

  server.registerTool(
    "write_file",
    {
      title: "Write file",
      description:
        "Creates or overwrites a file in the file store. Parent folders are created automatically. " +
        "Use this to save notes, drafts, summaries, or generated documents.",
      inputSchema: {
        path: z.string().describe("Destination file path, e.g. notes/idea.md"),
        content: z.string().describe("Full content to write to the file"),
      },
    },
    async ({ path: inputPath, content }) => {
      const abs = resolveInRoot(roots, inputPath);
      const info = await writeFileContents(abs, content);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, action: "wrote", path: info.path, size: info.size },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "append_file",
    {
      title: "Append to file",
      description:
        "Appends content to an existing file, or creates the file if it does not exist. " +
        "Use this to keep growing a running log or notes file.",
      inputSchema: {
        path: z.string().describe("File path to append to"),
        content: z
          .string()
          .describe("Content to append (add your own newline if needed)"),
      },
    },
    async ({ path: inputPath, content }) => {
      const abs = resolveInRoot(roots, inputPath);
      const info = await appendFileContents(abs, content);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, action: "appended", path: info.path, size: info.size },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "create_directory",
    {
      title: "Create directory",
      description: "Creates a folder (and any missing parents) inside the file store.",
      inputSchema: {
        path: z.string().describe("Directory path to create"),
      },
    },
    async ({ path: inputPath }) => {
      const abs = resolveInRoot(roots, inputPath);
      const info = await createDirectory(abs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, action: "created", path: info.path },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "move_file",
    {
      title: "Move / rename file",
      description: "Moves or renames a file or folder inside the file store.",
      inputSchema: {
        source: z.string().describe("Existing path"),
        destination: z.string().describe("New path"),
      },
    },
    async ({ source, destination }) => {
      const srcAbs = resolveInRoot(roots, source);
      const destAbs = resolveInRoot(roots, destination);
      const result = await moveEntry(srcAbs, destAbs);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.registerTool(
    "delete_file",
    {
      title: "Delete file or folder",
      description:
        "Permanently deletes a file or folder (recursively) from the file store. Use with care.",
      inputSchema: {
        path: z.string().describe("Path to delete"),
      },
    },
    async ({ path: inputPath }) => {
      const abs = resolveInRoot(roots, inputPath);
      const result = await deleteEntry(abs);
      return {
        content: [
          { type: "text", text: JSON.stringify({ ok: true, ...result }, null, 2) },
        ],
      };
    }
  );

  return server;
}
