import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
/**
 * Resolves an allowed root directory. Falls back to <server-folder>/chatgpt
 * when the environment variable is not set or invalid.
 */
export function getDefaultRoots() {
    const configured = process.env.CHATGPT_FILE_STORE_DIRS;
    const roots = new Set();
    if (configured) {
        for (const raw of configured.split(",")) {
            const dir = raw.trim();
            if (dir) {
                roots.add(path.resolve(expandHome(dir)));
            }
        }
    }
    if (roots.size === 0) {
        roots.add(path.join(process.cwd(), "chatgpt"));
    }
    return [...roots];
}
function expandHome(p) {
    if (p === "~")
        return os.homedir();
    if (p.startsWith("~/"))
        return path.join(os.homedir(), p.slice(2));
    return p;
}
/**
 * Converts a user-supplied path (absolute or relative) into an absolute
 * path inside one of the allowed roots. Throws if it escapes the sandbox.
 * Relative paths are resolved against the first allowed directory.
 */
export function resolveInRoot(roots, input) {
    const anchor = roots[0] ?? process.cwd();
    const absolute = path.isAbsolute(input)
        ? path.normalize(input)
        : path.resolve(anchor, input);
    // Reject any path that tries to escape upward with ".."
    const normalizedRoots = roots.map((r) => path.normalize(r));
    const matchedRoot = normalizedRoots.find((root) => {
        const rel = path.relative(root, absolute);
        return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    });
    if (!matchedRoot) {
        throw new Error(`Access denied: "${input}" is outside the allowed directories.\n` +
            `Allowed directories:\n${normalizedRoots.map((r) => `  - ${r}`).join("\n")}`);
    }
    return absolute;
}
/** Recursively ensures every parent directory exists. */
export async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}
export async function listDirectory(dir) {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const entries = [];
    for (const d of dirents) {
        const full = path.join(dir, d.name);
        let size = 0;
        let modified = "";
        let type = "other";
        try {
            const stat = await fs.stat(full);
            size = stat.size;
            modified = stat.mtime.toISOString();
            type = stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other";
        }
        catch {
            // Ignore stat failures (e.g. broken symlinks)
        }
        entries.push({ name: d.name, path: full, type, size, modified });
    }
    entries.sort((a, b) => {
        if (a.type === b.type)
            return a.name.localeCompare(b.name);
        return a.type === "directory" ? -1 : 1;
    });
    return entries;
}
export async function readFileContents(filePath) {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
        throw new Error(`"${filePath}" is a directory, not a file.`);
    }
    const buffer = await fs.readFile(filePath);
    return {
        content: buffer.toString("utf8"),
        encoding: "utf-8",
        size: buffer.length,
    };
}
export async function writeFileContents(filePath, content) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
    return getFileInfo(filePath);
}
export async function appendFileContents(filePath, content) {
    await ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, content, "utf8");
    return getFileInfo(filePath);
}
export async function createDirectory(dirPath) {
    await ensureDir(dirPath);
    return getFileInfo(dirPath);
}
export async function deleteEntry(targetPath) {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true });
    }
    else {
        await fs.unlink(targetPath);
    }
    return { deleted: targetPath };
}
export async function moveEntry(source, destination) {
    await ensureDir(path.dirname(destination));
    await fs.rename(source, destination);
    return { moved: { from: source, to: destination } };
}
export async function getFileInfo(filePath) {
    const stat = await fs.stat(filePath);
    return {
        name: path.basename(filePath),
        path: filePath,
        type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
        size: stat.size,
        modified: stat.mtime.toISOString(),
        permissions: stat.mode.toString(8).slice(-3),
    };
}
/** Searches a directory tree for files matching a glob-style pattern. */
export async function searchFiles(root, pattern, recursive = true) {
    const regex = globToRegExp(pattern);
    const matches = [];
    const walk = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (recursive)
                    await walk(full);
            }
            else if (entry.isFile() && regex.test(entry.name)) {
                matches.push(full);
            }
        }
    };
    await walk(root);
    return matches;
}
function globToRegExp(pattern) {
    const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "\u0000")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")
        .replace(/\u0000/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
}
//# sourceMappingURL=filesystem.js.map