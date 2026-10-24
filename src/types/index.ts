export type ServiceClass = 'A' | 'B' | 'C'; // A = Modern Trade, B = General Trade, C = Small Kirana
export type RetailerType = 'kirana' | 'modern_trade' | 'distributor';
export type ForecastMethod = 'HistGradientBoosting' | 'MovingAverage' | 'Bootstrap' | 'PeerTransfer';
export type PlanStatus = 'RUNNING' | 'READY' | 'PROVISIONAL' | 'APPROVED' | 'FAILED';
export type SolverStatus = 'OPTIMAL' | 'FEASIBLE' | 'TIMEOUT';
export type LineStatus = 'PROPOSED' | 'APPROVED' | 'STALE' | 'OVERRIDDEN' | 'DISPATCHED' | 'CANCELLED' | 'EXPIRED';
export type InTransitStatus = 'IN_TRANSIT' | 'RECEIVED' | 'PARTIAL' | 'REJECTED';
export type RejectionReason = 'short_shelf_life' | 'damaged' | 'no_space' | 'wrong_sku';
export type UserRole = 'rohit' | 'sunita' | 'ganesh' | 'priya';

export interface Product {
  sku: string;
  name: string;
  category: string;
  unitCost: number; // in Rupees
  unitPrice: number; // in Rupees
  caseSize: number; // units per case
  spacePerCase: number; // standard-case space units (default 1)
  shelfLifeDays: number;
  perishable: boolean;
  image?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  capacityCasesPerCycle: number;
  utilizationCases?: number;
  managerName: string;
}

export interface Retailer {
  id: string;
  name: string;
  type: RetailerType;
  serviceClass: ServiceClass;
  city: string;
  minShelfLifePct: number; // e.g. 0.70 (70%)
  storageCases?: number; // max storage limit in standard cases
  currentStorageUsed?: number;
  paymentScore?: number; // 0.70 to 1.0 (FR-15 credit weighting)
  lastSyncAt: string; // ISO date
  isStale?: boolean; // >24h old
  isCriticalStale?: boolean; // >72h old
}

export interface Route {
  warehouseId: string;
  retailerId: string;
  costPerCaseRupees: number;
  transitDays: number;
}

export interface InventoryBatch {
  id: string;
  warehouseId: string;
  sku: string;
  batchNo: string;
  qtyUnits: number;
  reservedUnits: number;
  expiryDate: string; // YYYY-MM-DD
  version: number;
  asOf: string;
}

export interface DemandForecast {
  retailerId: string;
  sku: string;
  q10: number;
  q50: number; // median
  q80: number;
  q90: number;
  q95: number;
  method: ForecastMethod;
  flags: string[];
  stockoutCorrected: boolean;
  historyDays: number;
  wape: number;
  bias: number;
  lastWeekActual: number;
}

export interface ValueTierDetail {
  tier: string;
  caseRange: string;
  probThisCycle: number;
  probLaterBeforeExpiry: number;
  expectedMarginRupees: number;
  freightAndHoldingRupees: number;
  netValueRupees: number;
  allocated: boolean;
}

export interface ReasonCard {
  summary: string;
  skuName: string;
  retailerName: string;
  sourceWarehouseName: string;
  demandMedian: number;
  demandP95: number;
  effectiveStockBefore: number;
  effectiveStockAfter: number;
  casesAllocated: number;
  unitsAllocated: number;
  shelfLifeOnArrivalPct: number;
  minRequiredShelfLifePct: number;
  shelfLifeDaysRemaining: number;
  latenessDays: number;
  latenessCostRupees: number;
  marginalTiers: ValueTierDetail[];
  cutoffReason: string;
  alternativeWarehouseCompared?: {
    warehouseName: string;
    freightDifferenceRupees: number;
    transitDaysDifference: number;
    latenessCostRupees: number;
    reasonNotChosen: string;
  };
}

export interface AllocationLine {
  id: string;
  planRunId: string;
  warehouseId: string;
  retailerId: string;
  sku: string;
  batchNo: string;
  cases: number;
  units: number;
  freightRupees: number;
  arrivalDate: string;
  shelfLifeOnArrivalPct: number;
  explanation: ReasonCard;
  status: LineStatus;
  override?: {
    originalCases: number;
    newCases: number;
    reason: string;
    overriddenBy: string;
    timestamp: string;
  };
  reservationExpiresAt: string;
}

export interface UnmetDemand {
  retailerId: string;
  sku: string;
  unmetCases: number;
  unmetUnits: number;
  reason: 'no_stock' | 'warehouse_capacity' | 'store_storage_limit' | 'shelf_life' | 'not_worth_freight';
  details: string;
}

export interface ComparisonMetrics {
  currentPractice: {
    stockoutUnits: number;
    fillRatePct: number;
    expiredUnits: number;
    freightRupees: number;
    lostMarginRupees: number;
  };
  strongBaseline: {
    stockoutUnits: number;
    fillRatePct: number;
    expiredUnits: number;
    freightRupees: number;
    lostMarginRupees: number;
  };
  hetvaya: {
    stockoutUnits: number;
    fillRatePct: number;
    expiredUnits: number;
    freightRupees: number;
    lostMarginRupees: number;
  };
}

export interface PlanRun {
  id: string;
  createdAt: string;
  createdBy: string;
  cycleStart: string;
  status: PlanStatus;
  snapshotHash: string;
  solverStatus: SolverStatus;
  solveSeconds: number;
  totalCases: number;
  totalFreightRupees: number;
  expectedMarginRupees: number;
  lines: AllocationLine[];
  unmet: UnmetDemand[];
  baselineScores: ComparisonMetrics;
  staleLocations: string[];
}

export interface SyncEvent {
  eventId: string; // UUID v4
  deviceId: string;
  deviceSeq: number;
  type: 'STOCK_COUNT' | 'SALE' | 'RECEIPT' | 'DISPATCH';
  occurredAt: string;
  payload: any;
  status: 'QUEUED' | 'APPLIED' | 'DUPLICATE' | 'SUPERSEDED' | 'REJECTED';
  reason?: string;
}

export interface InTransitShipment {
  id: string;
  planLineId: string;
  warehouseId: string;
  retailerId: string;
  sku: string;
  batchNo: string;
  cases: number;
  units: number;
  dispatchedAt: string;
  eta: string;
  status: InTransitStatus;
  acceptedCases?: number;
  rejectedCases?: number;
  rejectionReason?: RejectionReason;
}

export interface SystemAlert {
  id: string;
  rule: string;
  openedAt: string;
  type: 'EVENT' | 'TIME_BASED';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details: string;
  active: boolean;
}

export interface ScheduledJob {
  job: string;
  frequency: string;
  lastStartedAt: string;
  lastFinishedAt: string;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'OVERDUE';
  description: string;
}
