// Ambient types for the WebMCP browser API.
// Spec: https://webmachinelearning.github.io/webmcp/
// This mirrors the IDL in the draft spec so we get TS help when
// the browser exposes the real thing.

interface ToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

interface ToolExecuteCallbackOptions {
  signal: AbortSignal;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolExecuteCallback = (input: any, options: ToolExecuteCallbackOptions) => Promise<any>;

interface ModelContextTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  execute: ToolExecuteCallback;
  annotations?: ToolAnnotations;
}

interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  window: Window;
  origin: string;
  annotations?: ToolAnnotations;
}

interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: { exposedTo?: string[]; signal?: AbortSignal }): Promise<void>;
  getTools(options?: { fromOrigins?: string[] }): Promise<RegisteredTool[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  executeTool(tool: RegisteredTool, input?: object, options?: { signal?: AbortSignal }): Promise<string>;
  ontoolchange: ((this: ModelContext, ev: Event) => void) | null;
}

interface Document {
  readonly modelContext?: ModelContext;
}
