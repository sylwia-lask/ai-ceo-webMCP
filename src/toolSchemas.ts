// Shared tool schemas — used by vite.config.ts (Node.js) AND the browser bundle.
// Keep descriptions in sync with ACTIONS in companyLogic.ts.

export interface McpToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_SCHEMAS: McpToolSchema[] = [
  {
    name: 'adopt_ai',
    description:
      'Integrate AI into everything. Effects: hypeLevel +25, monthlyRevenue +50000, technicalDebt +10, employeeHappiness -5.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'rewrite_in_rust',
    description:
      'Rewrite legacy code in Rust. Effects: technicalDebt -10, monthlyRevenue -100000, employeeHappiness -25, productionIncidents +1, hypeLevel +15.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pivot_to_agents',
    description:
      'Pivot to AI agents. Effects: hypeLevel +35, monthlyRevenue +25000, technicalDebt +15, employeeHappiness -10.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'schedule_all_hands',
    description:
      'Schedule a mandatory all-hands meeting. Effects: employeeHappiness -10, hypeLevel +5.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'hire_developers',
    description:
      'Hire 3 developers. Effects: developers +3, cash -600000, technicalDebt -5, employeeHappiness +5.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'fire_developers',
    description:
      'Fire 3 developers. Effects: developers -3, cash +300000, employeeHappiness -30, technicalDebt +10.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'launch_product',
    description:
      'Launch the product. Effects: monthlyRevenue +150000, productionIncidents +2, employeeHappiness -5, cash +500000.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'buy_startup',
    description:
      'Acquire another startup. Effects: cash -2000000, developers +8, technicalDebt +25, hypeLevel +20.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'fix_production_bugs',
    description:
      'Fix production bugs. Effects: productionIncidents -2, technicalDebt -5, employeeHappiness +10, monthlyRevenue +25000.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'improve_developer_experience',
    description:
      'Invest in developer tooling. Effects: cash -250000, employeeHappiness +20, technicalDebt -10, hypeLevel -5.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_company_status',
    description: 'Returns current company metrics and status without making any changes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'reset_company',
    description: 'Resets the company to its initial state. All progress is lost.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'make_ceo_decision',
    description:
      'Apply a high-level CEO strategy. Automatically executes the right sequence of actions.',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: [
            'maximize_hype',
            'maximize_revenue',
            'reduce_technical_debt',
            'keep_employees_happy',
            'act_like_linkedin_ceo',
            'act_like_sensible_ceo',
          ],
          description: 'The CEO strategy to apply.',
        },
      },
      required: ['strategy'],
    },
  },
];
