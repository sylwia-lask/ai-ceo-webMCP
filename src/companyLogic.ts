import type { CompanyState, LogEntry, CeoStrategy } from './types';

export const INITIAL_STATE: CompanyState = {
  name: 'StartupGPT Inc.',
  cash: 10_000_000,
  monthlyRevenue: 500_000,
  developers: 12,
  employeeHappiness: 72,
  technicalDebt: 45,
  productionIncidents: 2,
  hypeLevel: 30,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyDeltas(
  state: CompanyState,
  deltas: Partial<Record<Exclude<keyof CompanyState, 'name'>, number>>,
): CompanyState {
  return {
    ...state,
    cash: state.cash + (deltas.cash ?? 0),
    monthlyRevenue: state.monthlyRevenue + (deltas.monthlyRevenue ?? 0),
    developers: Math.max(0, state.developers + (deltas.developers ?? 0)),
    employeeHappiness: clamp(state.employeeHappiness + (deltas.employeeHappiness ?? 0), 0, 100),
    technicalDebt: clamp(state.technicalDebt + (deltas.technicalDebt ?? 0), 0, 100),
    productionIncidents: Math.max(0, state.productionIncidents + (deltas.productionIncidents ?? 0)),
    hypeLevel: clamp(state.hypeLevel + (deltas.hypeLevel ?? 0), 0, 100),
  };
}

export interface CompanyStatus {
  label: string;
  color: 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple';
}

export function getCompanyStatus(state: CompanyState): CompanyStatus {
  if (state.cash < 500_000) return { label: 'Somehow Still Funded', color: 'red' };
  if (state.employeeHappiness < 25) return { label: 'Employees Updating LinkedIn', color: 'red' };
  if (state.productionIncidents >= 6) return { label: 'Production Is Fully Ablaze', color: 'red' };
  if (state.technicalDebt > 80) return { label: 'Rewrite Everything Crisis', color: 'orange' };
  if (state.hypeLevel > 80) return { label: 'LinkedIn Thought Leadership Mode', color: 'purple' };
  if (state.employeeHappiness < 45) return { label: 'Silent Quitting In Progress', color: 'orange' };
  if (state.developers < 4) return { label: 'Two Guys in a Garage', color: 'yellow' };
  if (state.employeeHappiness > 85 && state.technicalDebt < 20) return { label: 'Actually Profitable™', color: 'green' };
  if (state.cash > 15_000_000 && state.hypeLevel > 60) return { label: 'Ramen Profitable But Make It Fancy', color: 'blue' };
  return { label: 'Reasonably Stable', color: 'blue' };
}

export interface ActionDef {
  label: string;
  emoji: string;
  description: string;
  category: 'growth' | 'risk' | 'hr' | 'ops';
  deltas: Partial<Record<Exclude<keyof CompanyState, 'name'>, number>>;
  messages: string[];
}

export const ACTIONS: Record<string, ActionDef> = {
  adoptAI: {
    label: 'Adopt AI',
    emoji: '🤖',
    description: 'Integrate AI into everything. EVERYTHING.',
    category: 'growth',
    deltas: { hypeLevel: 25, monthlyRevenue: 50_000, technicalDebt: 10, employeeHappiness: -5 },
    messages: [
      '🤖 Adopted AI. Engineers now "pair program with AI" (use it to find Stack Overflow answers faster).',
      '🤖 AI fully adopted! The pitch deck writes itself. Technical debt writes itself too.',
      '🤖 73% of meetings now open with "as an AI-first company." Stock price: vibes.',
    ],
  },
  rewriteInRust: {
    label: 'Rewrite in Rust',
    emoji: '⚙️',
    description: 'The legacy Python monolith has FEELINGS. Time for fearless concurrency.',
    category: 'risk',
    deltas: { technicalDebt: -10, monthlyRevenue: -100_000, employeeHappiness: -25, productionIncidents: 1, hypeLevel: 15 },
    messages: [
      '⚙️ Rust rewrite begun. Three engineers quit. The fourth is writing a blog post titled "Why We Chose Rust."',
      '⚙️ Rewriting in Rust! Productivity down 80%. Borrow checker errors up 10,000%. Morale: ferrous.',
      '⚙️ Rust rewrite approved! CEO tweeted "fearless concurrency" without knowing what that means.',
    ],
  },
  pivotToAgents: {
    label: 'Pivot to Agents',
    emoji: '🕵️',
    description: "We're not a SaaS company. We're an agentic AI orchestration platform.",
    category: 'growth',
    deltas: { hypeLevel: 35, monthlyRevenue: 25_000, technicalDebt: 15, employeeHappiness: -10 },
    messages: [
      '🕵️ Pivoted to agents. Investors are thrilled. No one can explain what changed.',
      '🕵️ We are now an agentic AI platform. Product is the same. The landing page is not.',
      '🕵️ Pivot complete. We now have 47 "agents" doing the work of one if-statement.',
    ],
  },
  scheduleAllHands: {
    label: 'Schedule All-Hands',
    emoji: '📣',
    description: 'A mandatory two-hour meeting will definitely fix culture.',
    category: 'hr',
    deltas: { employeeHappiness: -10, hypeLevel: 5 },
    messages: [
      '📣 All-hands complete. CEO said "synergy" 14 times. Engineers kept cameras off.',
      '📣 Two-hour all-hands ended with "we will circle back offline." Action items: zero.',
      '📣 All-hands scheduled at 4:30pm on a Friday. Attendance: mandatory. Morale: not.',
    ],
  },
  hireDevelopers: {
    label: 'Hire Developers',
    emoji: '👨‍💻',
    description: "More engineers = more productivity. That's how it works, right?",
    category: 'hr',
    deltas: { developers: 3, cash: -600_000, technicalDebt: -5, employeeHappiness: 5 },
    messages: [
      '👨‍💻 Hired 3 developers! Onboarding doc is a Notion page last updated in 2021.',
      '👨‍💻 3 new engineers joined. They asked about the equity cliff within 10 minutes.',
      '👨‍💻 3 senior engineers hired. All immediately assigned to the rewrite that started last sprint.',
    ],
  },
  fireDevelopers: {
    label: 'Fire Developers',
    emoji: '📉',
    description: 'Right-sizing. Optimizing the org structure. Making hard decisions.',
    category: 'hr',
    deltas: { developers: -3, cash: 300_000, employeeHappiness: -30, technicalDebt: 10 },
    messages: [
      '📉 "Right-sized" by 3. The Slack channels are eerily quiet.',
      '📉 3 devs let go for "efficiency." The systems they owned are now "deprioritized."',
      '📉 3 engineers removed. CEO posted a heartfelt LinkedIn tribute: "These people are incredible."',
    ],
  },
  launchProduct: {
    label: 'Launch Product',
    emoji: '🚀',
    description: 'Ship it. Users will file the bugs.',
    category: 'ops',
    deltas: { monthlyRevenue: 150_000, productionIncidents: 2, employeeHappiness: -5, cash: 500_000 },
    messages: [
      '🚀 Launched on Product Hunt! Ranked #3. Production was down for 4 hours immediately after.',
      '🚀 Product shipped! TechCrunch covered it. One feature works. The rest are "roadmap."',
      '🚀 LIVE! Revenue up. Database is sweating. On-call engineer has not slept since Thursday.',
    ],
  },
  buyStartup: {
    label: 'Buy Another Startup',
    emoji: '🏦',
    description: "If you can't build it, acquire it and create integration debt.",
    category: 'risk',
    deltas: { cash: -2_000_000, developers: 8, technicalDebt: 25, hypeLevel: 20 },
    messages: [
      '🏦 Acquired a startup! We now own 4 incompatible auth systems. Great synergies ahead.',
      '🏦 Acqui-hire complete. 8 engineers joined. 6 are silently updating their resumes.',
      '🏦 Bought for "culture fit." Their tech debt is now our tech debt. Hype: immense.',
    ],
  },
  fixProductionBugs: {
    label: 'Fix Production Bugs',
    emoji: '🔧',
    description: 'Maybe we should address those incidents from last sprint.',
    category: 'ops',
    deltas: { productionIncidents: -2, technicalDebt: -5, employeeHappiness: 10, monthlyRevenue: 25_000 },
    messages: [
      '🔧 Fixed 2 prod bugs. Root cause: a ternary operator written in 2019.',
      '🔧 Incidents resolved! The fix is held together by a try-catch and pure optimism.',
      '🔧 Production stabilized. Post-mortem written. Blamed on "unexpected load."',
    ],
  },
  improveDeveloperExperience: {
    label: 'Improve Dev Experience',
    emoji: '✨',
    description: 'Actually invest in tooling. Radical concept.',
    category: 'ops',
    deltas: { cash: -250_000, employeeHappiness: 20, technicalDebt: -10, hypeLevel: -5 },
    messages: [
      '✨ DevEx improved! CI/CD dropped from 45 minutes to 8. Engineers wept actual tears of joy.',
      '✨ New dev tooling deployed. Local dev setup now takes 20 minutes instead of 3 hours.',
      '✨ Invested in developer experience. Linter now auto-fixes things. Productivity: unstoppable.',
    ],
  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function executeAction(
  state: CompanyState,
  actionKey: string,
): { newState: CompanyState; entry: LogEntry } | null {
  const def = ACTIONS[actionKey];
  if (!def) return null;

  const newState = applyDeltas(state, def.deltas);
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toLocaleTimeString(),
    action: actionKey,
    label: def.label,
    message: pickRandom(def.messages),
    changes: def.deltas,
  };

  return { newState, entry };
}

export const STRATEGY_ACTIONS: Record<CeoStrategy, string[]> = {
  maximize_hype: ['adoptAI', 'pivotToAgents', 'scheduleAllHands'],
  maximize_revenue: ['launchProduct', 'fixProductionBugs', 'hireDevelopers'],
  reduce_technical_debt: ['fixProductionBugs', 'improveDeveloperExperience', 'fixProductionBugs'],
  keep_employees_happy: ['improveDeveloperExperience', 'hireDevelopers', 'fixProductionBugs'],
  act_like_linkedin_ceo: ['scheduleAllHands', 'adoptAI', 'pivotToAgents', 'scheduleAllHands'],
  act_like_sensible_ceo: ['fixProductionBugs', 'improveDeveloperExperience', 'hireDevelopers'],
};

export function formatCash(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

export function formatDelta(key: string, value: number): string {
  const sign = value >= 0 ? '+' : '';
  if (key === 'cash' || key === 'monthlyRevenue') return `${sign}${formatCash(value)}`;
  return `${sign}${value}`;
}
