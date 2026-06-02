import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import { TOOL_SCHEMAS } from './src/toolSchemas';

// ─── WebMCP HTTP plugin ───────────────────────────────────────────────────────
//
// Exposes an MCP-compatible HTTP endpoint at /.well-known/mcp AND /mcp.
// Chrome WebMCP extensions that make fetch requests to the page origin will hit
// these routes.  Tool calls are relayed to the React app via Vite's HMR
// WebSocket and resolved asynchronously before the HTTP response is sent.
//
// Transport:
//   GET  /.well-known/mcp              → JSON tool list (or SSE stream)
//   POST /.well-known/mcp              → JSON-RPC 2.0 (initialize / tools/list / tools/call)
//   OPTIONS /.well-known/mcp           → CORS preflight
//
// HMR relay (dev only):
//   server → browser: custom event  "mcp:call"        { id, name, args }
//   browser → server: custom event  "mcp:tool-result" { id, result?, error? }

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function webMcpPlugin(): Plugin {
  type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
  const pending = new Map<string, Pending>();

  return {
    name: 'webmcp-http-server',

    configureServer(server) {
      // Receive tool-call results from the React app (browser → Vite WS → here).
      server.ws.on(
        'mcp:tool-result',
        (data: { id: string; result?: unknown; error?: string }) => {
          const p = pending.get(data.id);
          if (!p) return;
          pending.delete(data.id);
          data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
        },
      );

      const MCP_PATHS = new Set(['/.well-known/mcp', '/mcp']);

      server.middlewares.use(
        async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const pathname = (req.url ?? '/').split('?')[0];
          if (!MCP_PATHS.has(pathname)) return next();

          // CORS — allow any extension origin to call these endpoints.
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Accept, Authorization, X-Api-Key, Mcp-Session-Id',
          );
          res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          // ── GET ── tool list (JSON or SSE)
          if (req.method === 'GET') {
            const acceptsSse = String(req.headers['accept'] ?? '').includes('text/event-stream');

            if (acceptsSse) {
              // MCP SSE transport: send endpoint URL then tool list
              res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              });
              res.write(`event: endpoint\ndata: ${JSON.stringify({ uri: '/mcp' })}\n\n`);
              const toolsMsg = { jsonrpc: '2.0', id: 0, result: { tools: TOOL_SCHEMAS } };
              res.write(`data: ${JSON.stringify(toolsMsg)}\n\n`);
              const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
              req.on('close', () => clearInterval(heartbeat));
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ tools: TOOL_SCHEMAS }));
            return;
          }

          // ── POST ── JSON-RPC 2.0
          if (req.method === 'POST') {
            let body: Record<string, unknown>;
            try {
              body = JSON.parse(await readBody(req)) as Record<string, unknown>;
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              return;
            }

            const id = String((body.id as string | number) ?? Date.now());
            const method = (body.method as string | undefined) ?? '';
            const params = ((body.params as Record<string, unknown>) ?? {});

            // MCP initialize handshake
            if (method === 'initialize') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: { listChanged: false } },
                    serverInfo: { name: 'AI CEO Simulator', version: '0.1.0' },
                  },
                }),
              );
              return;
            }

            // MCP initialized notification (no response needed)
            if (method === 'notifications/initialized') {
              res.writeHead(204);
              res.end();
              return;
            }

            // List tools
            if (method === 'tools/list') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOL_SCHEMAS } }));
              return;
            }

            // Call tool — relay to React app via Vite HMR WebSocket
            if (method === 'tools/call') {
              const toolName = (params.name as string) ?? '';
              const toolArgs = ((params.arguments as Record<string, unknown>) ?? {});

              const result = await new Promise<unknown>((resolve, reject) => {
                pending.set(id, { resolve, reject });
                // Send to all connected browser clients (dev: usually just one tab)
                server.ws.send({
                  type: 'custom',
                  event: 'mcp:call',
                  data: { id, name: toolName, args: toolArgs },
                });
                setTimeout(() => {
                  if (!pending.has(id)) return;
                  pending.delete(id);
                  reject(new Error(`Tool "${toolName}" timed out after 5 s`));
                }, 5_000);
              }).catch((e: Error) => ({ error: e.message }));

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                  },
                }),
              );
              return;
            }

            // Unknown method
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${method}` },
              }),
            );
            return;
          }

          next();
        },
      );
    },
  };
}

// ─── Vite config ──────────────────────────────────────────────────────────────

export default defineConfig({
  base: '/ai-ceo-webMCP/',
  plugins: [tailwindcss(), react(), webMcpPlugin()],
});
