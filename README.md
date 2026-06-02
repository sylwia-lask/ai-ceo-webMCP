# AI CEO Simulator · WebMCP demo

A tongue-in-cheek startup management game where an AI agent runs your company through the **Model Context Protocol (MCP)** — directly from the browser, with no backend.

**Live demo:** https://sylwia-lask.github.io/ai-ceo-webmcp/

## What it is

You play a board that watches while an AI CEO makes increasingly questionable strategic decisions: rewriting everything in Rust, pivoting to agents, scheduling mandatory all-hands meetings at 4:30 on Fridays.

The interesting part is the plumbing: the app exposes MCP tools that any WebMCP-compatible AI agent can call. The agent sees the current company state and a menu of actions; it decides what to execute; the UI updates in real time.

## How the WebMCP integration works

When the app loads it registers a set of tools using every mechanism a WebMCP browser extension might expect:

| Strategy | How |
|---|---|
| Native API | `navigator.modelContext` / `document.modelContext` (Chrome experimental flag) |
| Window globals | `window.webmcp`, `window.mcp`, `window.__webmcp__`, … |
| JSON-RPC postMessage | Standard MCP over `window.postMessage` |
| CustomEvent broadcast | `mcp:register`, `webmcp:register`, … |
| Passive exposure | `window.__mcp_tools__`, `window.__mcp_handlers__`, … |
| HTTP endpoint (dev) | `GET/POST /.well-known/mcp` via Vite HMR relay |

Each tool handler is a closure over the React state via refs, so the agent always sees and mutates live data.

## Available tools

| Tool | Effect |
|---|---|
| `adopt_ai` | +hype, +revenue, +tech debt |
| `rewrite_in_rust` | −tech debt, −revenue, −happiness |
| `pivot_to_agents` | +hype, +revenue, +tech debt |
| `schedule_all_hands` | −happiness, +hype |
| `hire_developers` | +devs, −cash |
| `fire_developers` | −devs, +cash, −happiness |
| `launch_product` | +revenue, +incidents |
| `buy_startup` | +devs, −cash, +tech debt |
| `fix_production_bugs` | −incidents, −tech debt |
| `improve_developer_experience` | +happiness, −tech debt, −cash |
| `get_company_status` | read-only snapshot |
| `reset_company` | back to initial state |
| `make_ceo_decision` | high-level strategy (executes a sequence of actions) |

## Running locally

```bash
npm install
npm run dev
```

The dev server exposes `http://localhost:5173` and an MCP HTTP endpoint at `http://localhost:5173/.well-known/mcp`.

## Tech stack

- React 19 + TypeScript
- Tailwind CSS v4
- Vite 6
- No backend — all state lives in `sessionStorage`
