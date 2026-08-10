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
export declare function gatherKnowledge(roots: string[], options?: GatherOptions): Promise<GatherResult>;
/** Renders the collected documents as one Markdown document. */
export declare function renderMarkdown(result: GatherResult): string;
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
export declare function extractFlows(doc: KnowledgeDoc): FlowSource[];
/** Renders every flow found across the collected documents. */
export declare function renderPlantUml(result: GatherResult): string;
/**
 * Markdown by default, PlantUML when the content actually describes a flow —
 * the "auto" behaviour. Returns both when flows are present so the caller
 * keeps the surrounding context.
 */
export declare function renderAuto(result: GatherResult): string;
