/**
 * FlowGrid Unified Full-Stack API Client
 * Connects React frontend components to the FastAPI backend at http://localhost:8000/api/v1
 * Supports resilient fallback to offline mock data when the backend service is offline.
 */

import {
  Product,
  Warehouse,
  Retailer,
  InventoryBatch,
  DemandForecast,
  PlanRun,
  AllocationLine,
  ReasonCard,
  UserRole
} from '../types';

import {
  INITIAL_PRODUCTS,
  INITIAL_WAREHOUSES,
  INITIAL_RETAILERS,
  INITIAL_BATCHES,
  INITIAL_FORECASTS
} from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Role identity configuration
export interface UserPersonaConfig {
  email: string;
  role: string;
  name: string;
}

export const PERSONA_MAP: Record<UserRole, UserPersonaConfig> = {
  rohit: {
    email: 'rohit@flowgrid.internal',
    role: 'PLANNER',
    name: 'Rohit Sharma (Supply Chain Planner)',
  },
  sunita: {
    email: 'sunita@flowgrid.internal',
    role: 'APPROVER',
    name: 'Sunita Deshmukh (Warehouse Approver & Mgr)',
  },
  ganesh: {
    email: 'ganesh@flowgrid.internal',
    role: 'OPERATOR',
    name: 'Ganesh Patil (Kirana Retailer)',
  },
  priya: {
    email: 'priya@flowgrid.internal',
    role: 'ADMIN',
    name: 'Priya Kulkarni (System Administrator)',
  },
};

let currentPersona: UserRole = 'rohit';
let authToken: string | null = null;

export function setActiveUserRole(role: UserRole): void {
  currentPersona = role;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
}

function getHeaders(customRole?: UserRole): HeadersInit {
  const persona = PERSONA_MAP[customRole || currentPersona];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Email': persona.email,
    'X-User-Role': persona.role,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export interface BackendHealthStatus {
  isOnline: boolean;
  status: string;
  database: string;
  latencyMs: number;
  environment?: string;
  version?: string;
}

export interface OllamaHealthStatus {
  status: string;
  isConnected: boolean;
  model: string;
  availableModels: Array<{ name: string; size?: number }>;
}

export interface FMCGEngineRunParams {
  top_n_skus?: number;
  num_stores?: number;
  use_net_replenishment?: boolean;
  simulated_stock_seed?: number;
  create_plan_record?: boolean;
}

export interface FMCGEngineResult {
  engine_status: string;
  plan_code?: string;
  plan_id?: number;
  module_1_inventory_dashboard: Record<string, any>;
  module_2_demand_prediction: Record<string, any>;
  module_3_distribution_recommendations: Array<{
    product: string;
    from_warehouse: string;
    to_store: string;
    quantity: number;
    estimated_cost: string;
    reason: string;
    dispatch_priority?: string;
  }>;
  module_4_optimization_dashboard: Record<string, any>;
  executive_dispatch_briefing?: string;
  key_feature_insights?: Array<Record<string, any>>;
}

export const FlowGridAPI = {
  /**
   * Health and Telemetry Check
   */
  async checkHealth(): Promise<BackendHealthStatus> {
    const start = performance.now();
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/health/readiness`, {
        headers: getHeaders(),
      }, 3000);
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json();
        return {
          isOnline: true,
          status: data.status || 'READY',
          database: data.database || 'CONNECTED',
          latencyMs,
          environment: data.environment,
          version: data.version,
        };
      }
      return {
        isOnline: false,
        status: `HTTP_${res.status}`,
        database: 'DEGRADED',
        latencyMs,
      };
    } catch {
      return {
        isOnline: false,
        status: 'OFFLINE',
        database: 'OFFLINE',
        latencyMs: 9999,
      };
    }
  },

  /**
   * Ollama LLM Status
   */
  async getOllamaStatus(): Promise<OllamaHealthStatus> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/ai/status`, {
        headers: getHeaders(),
      }, 3000);
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status || 'ONLINE',
          isConnected: data.is_connected ?? true,
          model: data.configured_model || 'llama3',
          availableModels: data.available_models || [],
        };
      }
    } catch {
      // Fallback
    }
    return {
      status: 'OFFLINE (Fallback Active)',
      isConnected: false,
      model: 'heuristic-rules-engine',
      availableModels: [],
    };
  },

  /**
   * Fetch Catalog Warehouses
   */
  async getWarehouses(): Promise<Warehouse[]> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/warehouses?page_size=50`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          return items.map((w: any) => ({
            id: w.code || `WH-${w.id}`,
            name: w.name,
            city: w.region,
            capacityCasesPerCycle: Math.round((w.capacity_limit || 500000) / 10),
            utilizationCases: Math.round((w.capacity_limit || 500000) * 0.42 / 10),
            managerName: 'Sunita Deshmukh',
          }));
        }
      }
    } catch (e) {
      console.warn('Backend warehouses fetch fallback to local mock:', e);
    }
    return INITIAL_WAREHOUSES;
  },

  /**
   * Fetch Catalog Retailers / Stores
   */
  async getRetailers(): Promise<Retailer[]> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/stores?page_size=50`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          return items.map((s: any) => ({
            id: s.code || `STORE-${s.id}`,
            name: s.name,
            type: s.store_type === 'FLAGSHIP' ? 'modern_trade' : 'kirana',
            serviceClass: s.priority_tier === 1 ? 'A' : s.priority_tier === 2 ? 'B' : 'C',
            city: s.region,
            minShelfLifePct: 0.70,
            storageCases: 400,
            currentStorageUsed: 120,
            paymentScore: 0.95,
            lastSyncAt: new Date().toISOString(),
          }));
        }
      }
    } catch (e) {
      console.warn('Backend stores fetch fallback to local mock:', e);
    }
    return INITIAL_RETAILERS;
  },

  /**
   * Fetch Catalog Products / SKUs
   */
  async getProducts(): Promise<Product[]> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/products?page_size=100`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          return items.map((p: any) => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            unitCost: p.unit_cost || 100,
            unitPrice: Math.round((p.unit_cost || 100) * 1.25),
            caseSize: 12,
            spacePerCase: 1,
            shelfLifeDays: p.shelf_life_days || 180,
            perishable: p.is_perishable ?? (p.shelf_life_days < 90),
          }));
        }
      }
    } catch (e) {
      console.warn('Backend products fetch fallback to local mock:', e);
    }
    return INITIAL_PRODUCTS;
  },

  /**
   * Fetch Authoritative Inventory Batches
   */
  async getBatches(): Promise<InventoryBatch[]> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/inventory/batches?page_size=100`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const items = json.items || [];
        if (items.length > 0) {
          return items.map((b: any) => ({
            id: `B-${b.warehouse_code}-${b.sku}-${b.batch_number}`,
            warehouseId: b.warehouse_code || 'WH-01',
            sku: b.sku,
            batchNo: b.batch_number,
            qtyUnits: b.on_hand_quantity,
            reservedUnits: b.reserved_quantity,
            expiryDate: b.expiry_date || '2027-01-01',
            version: b.version || 1,
            asOf: b.created_at || new Date().toISOString(),
          }));
        }
      }
    } catch (e) {
      console.warn('Backend batches fetch fallback to local mock:', e);
    }
    return INITIAL_BATCHES;
  },

  /**
   * Run Master AI FMCG Distribution Intelligence Engine (Problem Statement 2)
   */
  async runDistributionEngine(params: FMCGEngineRunParams = {}): Promise<FMCGEngineResult> {
    const payload = {
      top_n_skus: params.top_n_skus ?? 20,
      num_stores: params.num_stores ?? 10,
      use_net_replenishment: params.use_net_replenishment ?? true,
      simulated_stock_seed: params.simulated_stock_seed ?? 42,
      create_plan_record: params.create_plan_record ?? true,
    };

    const res = await fetchWithTimeout(`${API_BASE_URL}/ai/distribution-engine`, {
      method: 'POST',
      headers: getHeaders('rohit'), // Rohit (Planner) creates the plan
      body: JSON.stringify(payload),
    }, 15000);

    if (!res.ok) {
      throw new Error(`Engine request failed: HTTP ${res.status}`);
    }

    return await res.json();
  },

  /**
   * Authoritatively Approve Plan (Enforces Separation of Duties: Sunita/Approver)
   */
  async approvePlan(planCode: string): Promise<any> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/plans/${planCode}/approve`, {
      method: 'POST',
      headers: getHeaders('sunita'), // Distinct approver principal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Approval failed with HTTP ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Authoritatively Commit Plan & Decrement Inventory
   */
  async commitPlan(planCode: string): Promise<any> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/plans/${planCode}/commit`, {
      method: 'POST',
      headers: getHeaders('sunita'),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Commit failed with HTTP ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Cancel Plan
   */
  async cancelPlan(planCode: string, reason = 'Operator cancelled'): Promise<any> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/plans/${planCode}/cancel`, {
      method: 'POST',
      headers: getHeaders('rohit'),
      body: JSON.stringify({ reason }),
    });
    return await res.json();
  },

  /**
   * Explain Plan using Ollama Dynamic Reasoning (FR-P0-11)
   */
  async explainPlan(planCode: string): Promise<any> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/ai/explain-plan`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ plan_code: planCode }),
    });
    if (res.ok) {
      return await res.json();
    }
    return null;
  },

  /**
   * Record Store Sales Event (Kirana Terminal)
   */
  async recordSale(storeCode: string, sku: string, unitsSold: number): Promise<any> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/sales`, {
        method: 'POST',
        headers: getHeaders('ganesh'),
        body: JSON.stringify({
          store_code: storeCode,
          sku,
          units_sold: unitsSold,
          observation_date: new Date().toISOString().split('T')[0],
          is_stockout_day: false,
        }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Record sale offline queued:', e);
      return { status: 'OFFLINE_QUEUED' };
    }
  },

  /**
   * Adjust Warehouse Batch Inventory (Warehouse Ops)
   */
  async adjustBatch(batchId: number, delta: number, reason: string): Promise<any> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/inventory/batches/${batchId}/adjust`, {
        method: 'POST',
        headers: getHeaders('sunita'),
        body: JSON.stringify({
          quantity_delta: delta,
          reason,
        }),
      });
      return await res.json();
    } catch (e) {
      console.warn('Batch adjust failed or offline:', e);
      return null;
    }
  },

  /**
   * Fetch Policy Comparison (Static vs Strong vs Hetvaya AI Solver)
   */
  async getPolicyComparison(planCode: string): Promise<any> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/comparisons/${planCode}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Return null to use mock benchmark
    }
    return null;
  },

  /**
   * Seed Flipkart 100-SKU Network into Database
   */
  async seedFlipkartNetwork(): Promise<any> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/inventory/seed-flipkart`, {
      method: 'POST',
      headers: getHeaders('priya'),
    });
    return await res.json();
  },
};
