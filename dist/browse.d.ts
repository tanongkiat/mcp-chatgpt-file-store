import type { IncomingMessage } from "node:http";
import { type FileEntry } from "./filesystem.js";
export interface BrowseConfig {
    user: string;
    hasPassword: boolean;
}
/** Current auth config, exposed for the server startup banner. */
export declare function getBrowseConfig(): BrowseConfig;
/** Constant-time comparison of the supplied credentials. */
export declare function checkCredentials(username: string, password: string): boolean;
/** Returns the logged-in username, or undefined when not authenticated. */
export declare function getSessionUser(req: IncomingMessage): string | undefined;
/** Set-Cookie value that establishes a new session. */
export declare function issueSessionCookie(user: string): string;
/** Set-Cookie value that clears the session. */
export declare function clearSessionCookie(): string;
export declare function renderLoginPage(opts: {
    error?: string;
    next?: string;
}): string;
export interface BrowseState {
    user: string;
    rel: string;
    entries: FileEntry[];
    error?: string;
}
/**
 * Renders the authenticated file browser for a relative path already resolved
 * inside the sandbox by the caller.
 */
export declare function renderBrowsePage(state: BrowseState): string;
export declare function renderFileViewPage(opts: {
    user: string;
    rel: string;
    name: string;
    error?: string;
}): Promise<string>;
/** Lists the directory for a relative path, throwing on sandbox escape. */
export declare function listForRel(rel: string): Promise<FileEntry[]>;
