export interface CompanyState {
  name: string;
  cash: number;
  monthlyRevenue: number;
  developers: number;
  employeeHappiness: number;
  technicalDebt: number;
  productionIncidents: number;
  hypeLevel: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  label: string;
  message: string;
  changes: Partial<Record<Exclude<keyof CompanyState, 'name'>, number>>;
}

export type CeoStrategy =
  | 'maximize_hype'
  | 'maximize_revenue'
  | 'reduce_technical_debt'
  | 'keep_employees_happy'
  | 'act_like_linkedin_ceo'
  | 'act_like_sensible_ceo';
