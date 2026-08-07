export interface FileEntry {
    name: string;
    path: string;
    type: "file" | "directory" | "other";
    size: number;
    modified: string;
}
export interface FileInfo extends FileEntry {
    permissions: string;
}
/**
 * Resolves an allowed root directory. Falls back to <server-folder>/chatgpt
 * when the environment variable is not set or invalid.
 */
export declare function getDefaultRoots(): string[];
/**
 * Converts a user-supplied path (absolute or relative) into an absolute
 * path inside one of the allowed roots. Throws if it escapes the sandbox.
 * Relative paths are resolved against the first allowed directory.
 */
export declare function resolveInRoot(roots: string[], input: string): string;
/** Recursively ensures every parent directory exists. */
export declare function ensureDir(dir: string): Promise<void>;
export declare function listDirectory(dir: string): Promise<FileEntry[]>;
export declare function readFileContents(filePath: string): Promise<{
    content: string;
    encoding: string;
    size: number;
}>;
export declare function writeFileContents(filePath: string, content: string): Promise<FileInfo>;
export declare function appendFileContents(filePath: string, content: string): Promise<FileInfo>;
export declare function createDirectory(dirPath: string): Promise<FileInfo>;
export declare function deleteEntry(targetPath: string): Promise<{
    deleted: string;
}>;
export declare function moveEntry(source: string, destination: string): Promise<{
    moved: {
        from: string;
        to: string;
    };
}>;
export declare function getFileInfo(filePath: string): Promise<FileInfo>;
/** Searches a directory tree for files matching a glob-style pattern. */
export declare function searchFiles(root: string, pattern: string, recursive?: boolean): Promise<string[]>;
