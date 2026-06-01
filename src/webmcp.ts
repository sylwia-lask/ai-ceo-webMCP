// WebMCP (Web Model Context Protocol) — multi-strategy registration
//
// This file tries every known mechanism used by WebMCP browser extensions and
// Chrome's experimental native API. Keep all WebMCP code here so one edit fixes all.
//
// Strategies attempted (in order):
//   1. navigator/document.modelContext  — Chrome native experimental flag
//   2. Injected window globals — various names extensions use
//   3. JSON-RPC postMessage    — MCP over window.postMessage (most common in extensions)
//   4. CustomEvent broadcast   — alternative event-based handshake
//   5. Passive window exposure — tools set on window so extensions can poll
//   6. Retry loop              — extensions often inject after React mounts
//
// CALL diagnoseWebMcpApi() from the browser console to log what the extension injected.

import type { CompanyState, CeoStrategy } from './types';
import {
  ACTIONS,
  INITIAL_STATE,
  STRATEGY_ACTIONS,
  executeAction,
  getCompanyStatus,
} from './companyLogic';

// ─── Types ────────────────────────────────────────────────────────────────────

export type McpToolDef = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: Record<string, unknown>) => any;
};

// ─── Diagnostic ───────────────────────────────────────────────────────────────

/** Call from the browser console: diagnoseWebMcpApi() */
export function diagnoseWebMcpApi() {
  const MCP_PATTERNS = /mcp|modelcontext|webmcp|tool|agent/i;
  const windowKeys = Object.keys(window).filter((k) => MCP_PATTERNS.test(k));
  console.group('[WebMCP Diagnostic]');
  console.log('Matching window keys:', windowKeys.length ? windowKeys : '(none)');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = document as any;
  console.log('navigator.modelContext:', nav.modelContext ?? '(undefined)');
  console.log('document.modelContext:', doc.modelContext ?? '(undefined)');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log('window.chrome.webMCP:', (window as any).chrome?.webMCP ?? '(undefined)');
  console.groupEnd();
  return windowKeys;
}
(window as unknown as Record<string, unknown>).diagnoseWebMcpApi = diagnoseWebMcpApi;

/**
 * Installs getters/setters on every common MCP-related window property name.
 * When the extension's content script reads or writes any of these, it logs exactly
 * which one — telling us the correct API to use.
 *
 * Run in console:  installWindowTraps()
 * Then reload the page and watch the console for "[Trap]" lines.
 */
export function installWindowTraps() {
  const TRAP_NAMES = [
    'webmcp', 'mcp', '__webmcp__', '__mcp__', 'WebMCP', 'MCP',
    'mcpServer', 'webMcpServer', 'mcpClient', 'webMcpClient',
    'modelContextProtocol', 'toolRegistry', 'registeredTools',
    'aiTools', 'webTools', 'toolServer', 'mcpTools', '__mcpServer__',
    'webMCPTools', 'webMCPServer',
  ];

  let trapped = 0;
  TRAP_NAMES.forEach((name) => {
    if (name in window) {
      console.log(`[Trap] window.${name} already exists:`, (window as unknown as Record<string, unknown>)[name]);
      return;
    }
    let _val: unknown;
    try {
      Object.defineProperty(window, name, {
        get() {
          console.log(`%c[Trap] window.${name} READ`, 'color:lime;font-weight:bold');
          return _val;
        },
        set(v: unknown) {
          console.log(`%c[Trap] window.${name} SET`, 'color:cyan;font-weight:bold', typeof v, v);
          _val = v;
        },
        configurable: true,
        enumerable: false,
      });
      trapped++;
    } catch { /* not configurable */ }
  });
  console.log(`[WebMCP Traps] ${trapped} traps installed. Reload the page and watch for [Trap] lines.`);
}
(window as unknown as Record<string, unknown>).installWindowTraps = installWindowTraps;

/** Logs ALL incoming postMessages that look MCP-related. Run once, then interact with the extension. */
export function startMessageMonitor() {
  const handler = (e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return;
    const keys = Object.keys(e.data as object);
    const looks_mcp = keys.some((k) => /mcp|tool|model|method|jsonrpc/i.test(k));
    if (looks_mcp || (e.data as Record<string,unknown>).jsonrpc) {
      console.log('%c[MsgMonitor] postMessage received', 'color:orange', e.data);
    }
  };
  window.addEventListener('message', handler);
  console.log('[MsgMonitor] Watching all postMessages. Interact with the extension now.');
  return () => window.removeEventListener('message', handler);
}
(window as unknown as Record<string, unknown>).startMessageMonitor = startMessageMonitor;

// ─── Tool builder ─────────────────────────────────────────────────────────────

function actionKeyToToolName(key: string): string {
  // Handles consecutive uppercase: adoptAI → adopt_ai (not adopt_a_i)
  return key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function buildTools(
  getState: () => CompanyState,
  dispatch: (key: string) => void,
  resetFn: () => void,
): McpToolDef[] {
  const actionTools: McpToolDef[] = Object.entries(ACTIONS).map(([key, def]) => ({
    name: actionKeyToToolName(key),
    description: `${def.description} Effects: ${Object.entries(def.deltas)
      .map(([k, v]) => `${k} ${(v ?? 0) >= 0 ? '+' : ''}${v}`)
      .join(', ')}.`,
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
    handler: () => {
      dispatch(key);
      const state = getState();
      const result = executeAction(state, key);
      return {
        action: key,
        message: result?.entry.message ?? 'Done.',
        updatedMetrics: result?.newState ?? state,
        companyStatus: getCompanyStatus(result?.newState ?? state).label,
      };
    },
  }));

  const statusTool: McpToolDef = {
    name: 'get_company_status',
    description: 'Returns current company metrics and status without making any changes.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => {
      const state = getState();
      return { metrics: state, companyStatus: getCompanyStatus(state).label };
    },
  };

  const resetTool: McpToolDef = {
    name: 'reset_company',
    description: 'Resets the company to its initial state. All progress is lost.',
    inputSchema: { type: 'object', properties: {}, required: [] },
    handler: () => {
      resetFn();
      return {
        message: 'Company reset to initial state.',
        metrics: INITIAL_STATE,
        companyStatus: getCompanyStatus(INITIAL_STATE).label,
      };
    },
  };

  const ceoTool: McpToolDef = {
    name: 'make_ceo_decision',
    description:
      'Apply a high-level CEO strategy. Automatically executes the right sequence of actions.',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: Object.keys(STRATEGY_ACTIONS) as CeoStrategy[],
          description: 'The CEO strategy to apply.',
        },
      },
      required: ['strategy'],
    },
    handler: (args) => {
      const strategy = args.strategy as CeoStrategy;
      const keys = STRATEGY_ACTIONS[strategy];
      if (!keys) return { error: `Unknown strategy: ${strategy}` };

      let state = getState();
      const messages: string[] = [];
      for (const key of keys) {
        const result = executeAction(state, key);
        if (result) {
          state = result.newState;
          dispatch(key);
          messages.push(result.entry.message);
        }
      }

      return {
        strategy,
        actionsExecuted: keys,
        messages,
        finalMetrics: state,
        companyStatus: getCompanyStatus(state).label,
      };
    },
  };

  return [...actionTools, statusTool, resetTool, ceoTool];
}

// ─── Serialisable schema (no functions) ──────────────────────────────────────

function toSchema(tools: McpToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

// ─── Strategy 1 – native modelContext ─────────────────────────────────────────

type ModelContextApi = {
  registerTool?: (tool: Record<string, unknown>) => unknown;
  unregisterTool?: (name: string) => unknown;
  provideContext?: (context: Record<string, unknown>) => unknown;
};

function getNativeModelContext(): ModelContextApi | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = document as any;
  return (nav.modelContext ?? doc.modelContext ?? null) as ModelContextApi | null;
}

async function tryNativeApi(tools: McpToolDef[]): Promise<boolean> {
  const mc = getNativeModelContext();
  if (!mc) return false;

  try {
    const normalised = tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: 'object', properties: {} },
      execute: async (args: Record<string, unknown>) => t.handler(args ?? {}),
    }));

    if (typeof mc.provideContext === 'function') {
      await mc.provideContext({ tools: normalised });
    } else if (typeof mc.registerTool === 'function') {
      for (const tool of normalised) {
        if (typeof mc.unregisterTool === 'function') {
          try {
            await mc.unregisterTool(tool.name);
          } catch {
            // Ignore tools that were not registered yet.
          }
        }
        await mc.registerTool(tool);
      }
    } else {
      return false;
    }

    console.log('[WebMCP] Registered via native modelContext.registerTool');
    return true;
  } catch (e) {
    console.warn('[WebMCP] native modelContext registration failed:', e);
    return false;
  }
}

// ─── Strategy 2 – injected window globals ─────────────────────────────────────

const INJECTION_NAMES = [
  'webmcp', 'mcp', '__webmcp__', '__mcp__', 'WebMCP', 'MCP',
  'mcpServer', 'webMcpServer', '__mcpServer__', 'modelContextProtocol',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryInjectedGlobals(tools: McpToolDef[]): Promise<boolean> {
  for (const name of INJECTION_NAMES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any)[name];
    if (!api || typeof api !== 'object') continue;
    const fn = api.registerTools ?? api.register ?? api.expose ?? api.addTools ?? api.setTools;
    if (typeof fn !== 'function') continue;
    try {
      const normalised = tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        execute: t.handler,
        handler: t.handler,
        call: t.handler,
      }));
      await fn.call(api, normalised);
      console.log(`[WebMCP] Registered via window.${name}`);
      return true;
    } catch (e) {
      console.warn(`[WebMCP] window.${name} registration failed:`, e);
    }
  }
  return false;
}

// ─── Strategy 3 – JSON-RPC over postMessage + call listener ──────────────────
//
// Many browser extensions implement a JSON-RPC 2.0 MCP relay:
//   page  → postMessage  → content-script  → extension MCP server
//   page  ← postMessage  ← content-script  ← tool calls from the agent
//
// We also broadcast simpler non-RPC formats some extensions use.

let callListenerInstalled = false;

function installCallListener(toolMap: Map<string, McpToolDef>) {
  if (callListenerInstalled) return;
  callListenerInstalled = true;

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // JSON-RPC 2.0 – tools/list
    if (data.jsonrpc === '2.0' && data.method === 'tools/list') {
      window.postMessage(
        {
          jsonrpc: '2.0',
          id: data.id,
          result: { tools: toSchema([...toolMap.values()]) },
        },
        '*',
      );
      return;
    }

    // JSON-RPC 2.0 – tools/call
    if (data.jsonrpc === '2.0' && data.method === 'tools/call') {
      const toolName = data.params?.name as string | undefined;
      const toolArgs = (data.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = toolName ? toolMap.get(toolName) : undefined;
      if (!tool) return;
      try {
        const result = await Promise.resolve(tool.handler(toolArgs));
        window.postMessage(
          {
            jsonrpc: '2.0',
            id: data.id,
            result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
          },
          '*',
        );
      } catch (err) {
        window.postMessage(
          { jsonrpc: '2.0', id: data.id, error: { code: -32000, message: String(err) } },
          '*',
        );
      }
      return;
    }

    // Simpler call formats used by some extensions
    const callTypes = ['mcp:call', 'webmcp:call', 'MCP_CALL', 'mcp:tool:call', 'CALL_MCP_TOOL'];
    if (callTypes.includes(data.type)) {
      const toolName = (data.tool ?? data.toolName ?? data.name) as string | undefined;
      const args = (data.args ?? data.arguments ?? {}) as Record<string, unknown>;
      const tool = toolName ? toolMap.get(toolName) : undefined;
      if (!tool) return;
      try {
        const result = await Promise.resolve(tool.handler(args));
        window.postMessage({ type: 'mcp:result', id: data.id, toolName, result }, '*');
      } catch (err) {
        window.postMessage({ type: 'mcp:error', id: data.id, toolName, error: String(err) }, '*');
      }
    }
  });
}

function broadcastViaPostMessage(tools: McpToolDef[]) {
  const schema = toSchema(tools);
  // JSON-RPC notification (no id = notification, no response expected)
  window.postMessage({ jsonrpc: '2.0', method: 'tools/register', params: { tools: schema } }, '*');
  // Simpler broadcast formats
  window.postMessage({ type: 'mcp:register', tools: schema }, '*');
  window.postMessage({ type: 'webmcp:register', tools: schema }, '*');
  window.postMessage({ type: 'REGISTER_MCP_TOOLS', tools: schema }, '*');
  window.postMessage({ type: 'MCP_TOOLS_AVAILABLE', tools: schema }, '*');
}

// ─── Strategy 4 – CustomEvent broadcast ──────────────────────────────────────

function broadcastViaEvents(tools: McpToolDef[]) {
  const schema = toSchema(tools);
  const names = ['mcp:register', 'webmcp:register', 'mcp-register', 'webmcp-register', 'mcp:tools:available'];
  for (const name of names) {
    window.dispatchEvent(new CustomEvent(name, { detail: { tools: schema } }));
  }
}

// ─── Strategy 5 – passive window exposure (extension can poll) ────────────────

function exposePassively(tools: McpToolDef[]) {
  const schema = toSchema(tools);
  // Schemas (serialisable) — extension reads these to display tool names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  win.__mcp_tools__ = schema;
  win.__webmcp_tools__ = schema;
  win.mcpTools = schema;
  win.__mcp_tool_definitions__ = schema;

  // Full tools with handlers — extension can call handler() directly if it has page access
  win.__mcp_handlers__ = Object.fromEntries(tools.map((t) => [t.name, t.handler]));
}

// ─── Strategy 6 – Vite HMR relay (dev only) ──────────────────────────────────
//
// The webMcpPlugin in vite.config.ts exposes an HTTP MCP server.
// When an extension calls a tool via HTTP POST, Vite sends an 'mcp:call' HMR
// event to the browser. We handle it here and send the result back so Vite
// can respond to the pending HTTP request.

function installHmrRelay(toolMap: Map<string, McpToolDef>) {
  if (!import.meta.hot) return; // production build — skip

  import.meta.hot.on(
    'mcp:call',
    async (payload: { id: string; name: string; args: Record<string, unknown> }) => {
      const { id, name, args } = payload;
      const tool = toolMap.get(name);
      if (!tool) {
        import.meta.hot!.send('mcp:tool-result', {
          id,
          error: `Unknown tool: "${name}". Available: ${[...toolMap.keys()].join(', ')}`,
        });
        return;
      }
      try {
        const result = await Promise.resolve(tool.handler(args));
        import.meta.hot!.send('mcp:tool-result', { id, result });
      } catch (e) {
        import.meta.hot!.send('mcp:tool-result', { id, error: String(e) });
      }
    },
  );

  console.log(
    '[WebMCP] HTTP relay active — tool calls via /.well-known/mcp are now wired to the app.',
    '\n  Endpoints: GET /.well-known/mcp  →  tool list',
    '\n             POST /.well-known/mcp →  tool call (JSON-RPC 2.0)',
  );
}

// ─── Main registration ────────────────────────────────────────────────────────

export async function registerWebMcpTools(
  getState: () => CompanyState,
  dispatch: (key: string) => void,
  resetFn: () => void,
): Promise<boolean> {
  const tools = buildTools(getState, dispatch, resetFn);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  // Wire up the Vite HMR relay (primary mechanism in dev — HTTP endpoint).
  installHmrRelay(toolMap);

  // postMessage call listener — for extensions that use window.postMessage.
  installCallListener(toolMap);

  // Passive exposure + one-shot broadcast.
  exposePassively(tools);
  broadcastViaPostMessage(tools);
  broadcastViaEvents(tools);

  // Try native/injected APIs once.
  if (await tryNativeApi(tools)) return true;
  if (await tryInjectedGlobals(tools)) return true;

  // Retry loop — polls for late-injected window APIs only (no re-broadcast spam).
  return new Promise((resolve) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 10; // 5 seconds

    const retry = setInterval(async () => {
      attempts++;
      if (await tryNativeApi(tools)) { clearInterval(retry); resolve(true); return; }
      if (await tryInjectedGlobals(tools)) { clearInterval(retry); resolve(true); return; }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(retry);
        console.log('[WebMCP] Ready. HTTP endpoint: /.well-known/mcp');
        resolve(true); // resolve true — HTTP endpoint is always available in dev
      }
    }, 500);
  });
}
