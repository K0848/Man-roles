export interface Phase7Task9ScenarioBudget { name: 'knowledge' | 'dilemma' | 'review' | 'high-risk' | 'cross-person'; allocated: number; minimumStart: number; repairReserve: number }
export const PHASE7_TASK9_SCENARIO_BUDGETS: readonly Phase7Task9ScenarioBudget[] = [
  { name: 'knowledge', allocated: 7000, minimumStart: 2500, repairReserve: 1800 },
  { name: 'dilemma', allocated: 5000, minimumStart: 1800, repairReserve: 1800 },
  { name: 'review', allocated: 4500, minimumStart: 2500, repairReserve: 1800 },
  { name: 'high-risk', allocated: 0, minimumStart: 0, repairReserve: 0 },
  { name: 'cross-person', allocated: 3500, minimumStart: 2200, repairReserve: 1500 },
]
