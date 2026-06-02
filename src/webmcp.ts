import type { CompanyState, CeoStrategy } from './types';
import {
  ACTIONS,
  INITIAL_STATE,
  STRATEGY_ACTIONS,
  executeAction,
  getCompanyStatus,
} from './companyLogic';

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

function toSchema(tools: McpToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

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
          } catch { /* not registered yet */ }
        }
        await mc.registerTool(tool);
      }
    } else {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

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
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

let callListenerInstalled = false;

function installCallListener(toolMap: Map<string, McpToolDef>) {
  if (callListenerInstalled) return;
  callListenerInstalled = true;

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

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
  window.postMessage({ jsonrpc: '2.0', method: 'tools/register', params: { tools: schema } }, '*');
  window.postMessage({ type: 'mcp:register', tools: schema }, '*');
  window.postMessage({ type: 'webmcp:register', tools: schema }, '*');
  window.postMessage({ type: 'REGISTER_MCP_TOOLS', tools: schema }, '*');
  window.postMessage({ type: 'MCP_TOOLS_AVAILABLE', tools: schema }, '*');
}

function broadcastViaEvents(tools: McpToolDef[]) {
  const schema = toSchema(tools);
  const names = ['mcp:register', 'webmcp:register', 'mcp-register', 'webmcp-register', 'mcp:tools:available'];
  for (const name of names) {
    window.dispatchEvent(new CustomEvent(name, { detail: { tools: schema } }));
  }
}

function exposePassively(tools: McpToolDef[]) {
  const schema = toSchema(tools);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  win.__mcp_tools__ = schema;
  win.__webmcp_tools__ = schema;
  win.mcpTools = schema;
  win.__mcp_tool_definitions__ = schema;
  win.__mcp_handlers__ = Object.fromEntries(tools.map((t) => [t.name, t.handler]));
}

function installHmrRelay(toolMap: Map<string, McpToolDef>) {
  if (!import.meta.hot) return;

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

}

export async function registerWebMcpTools(
  getState: () => CompanyState,
  dispatch: (key: string) => void,
  resetFn: () => void,
): Promise<boolean> {
  const tools = buildTools(getState, dispatch, resetFn);
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  installHmrRelay(toolMap);
  installCallListener(toolMap);
  exposePassively(tools);
  broadcastViaPostMessage(tools);
  broadcastViaEvents(tools);

  if (await tryNativeApi(tools)) return true;
  if (await tryInjectedGlobals(tools)) return true;

  return new Promise((resolve) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    const retry = setInterval(async () => {
      attempts++;
      if (await tryNativeApi(tools)) { clearInterval(retry); resolve(true); return; }
      if (await tryInjectedGlobals(tools)) { clearInterval(retry); resolve(true); return; }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(retry);
        resolve(true);
      }
    }, 500);
  });
}
