# FlowGrid: AI-Powered Distribution Intelligence & Inventory Optimization Engine

**SGU-TRIWIZATHON — Problem Statement 2: Distribution Intelligence & Inventory Optimization**

FlowGrid is an enterprise-grade decision-support and dispatch-optimization platform for FMCG distribution networks. It unifies demand forecasting, anomaly detection, and constraint-aware mathematical stock allocation to determine **what quantity of each product to move, from which warehouse, to which store, at minimum modeled transportation cost, with guaranteed zero hard-constraint violations**.

---

## 1. Machine Learning & Optimization Architecture

The engine integrates five specialized models organized into a closed-loop intelligence pipeline:

| Model | Primary Role | Algorithm / Framework | Key Attributes / Inputs | PRD Compliance & Safeguard |
| :--- | :--- | :--- | :--- | :--- |
| **Seasonal-Naive** | Safety Baseline Fallback | Lag Rule Engine ($\hat{y}_t = y_{t-7}$) | `lag_7`, `rolling_mean_7`, SKU median | **Mandatory (PRD FR-P0-02)**: Active fallback if ML underperforms or fails safety checks. |
| **Random Forest** | Stable Baseline ML | `sklearn.ensemble.RandomForestRegressor` | 24 temporal, lag, rolling, promo, and price features | **Mandatory (PRD FR-P0-02)**: Benchmarked against baseline with a 5% WAPE improvement gate. |
| **LightGBM Regressor** | High-Accuracy Demand Forecaster | `lightgbm.LGBMRegressor` | Gradient boosted trees over lag & rolling windows | **Recommended Upgrade**: Ultra-fast training (<2s), high non-linear promo/price responsiveness. |
| **Isolation Forest** | Shock & Outlier Detection | `sklearn.ensemble.IsolationForest` | Sales deviations, price ratio, promo flags, rolling statistics | **Anomaly Layer**: Detects demand shocks and clamps outliers to prevent inventory over-ordering. |
| **OR-Tools CP-SAT** | Constrained Stock Allocation | `ortools.sat.python.cp_model` | Forecast demand vector, warehouse stock, distance matrix | **Mandatory (PRD FR-P0-03)**: Mathematical solver optimizing routes while respecting stock limits. |

---

## 2. Faulty Output Prevention Safeguards

To prevent invalid, corrupted, or unrealistic outputs in production, the engine enforces five strict safeguards:

1. **Zero Data Leakage (Temporal Integrity):**
   - Strictly ordered by `[store_id, sku_id, date]`.
   - All lag features (`lag_1`, `lag_7`, `lag_14`, `lag_28`) and rolling statistics are computed on shifted data ($t-1$ or earlier). Demand from time $t$ is **never accessible** at prediction time $t$.
   - Train/test partitioning uses a **chronological split** (last 30 days as holdout), never a random row shuffle.

2. **Physical Realism Clamping:**
   - Physical inventory cannot have negative or fractional units.
   - All raw predictions pass through `sanitize_predictions()`:
     $$\hat{y}_{\text{clean}} = \text{round}(\max(0, \hat{y}_{\text{raw}}))$$
   - All `NaN`, `+inf`, and `-inf` entries are trapped and safely imputed.

3. **PRD FR-P0-02 Decision Gate (5% Relative WAPE Gate):**
   - The engine automatically computes Weighted Absolute Percentage Error (WAPE) across models:
     $$\text{WAPE} = \frac{\sum |y_t - \hat{y}_t|}{\sum y_t}$$
   - An ML model is only adopted if it achieves at least a **5% relative error reduction** over Seasonal-Naive. If data drift or underperformance occurs, the system automatically activates the Seasonal-Naive fallback.

4. **Anomaly Shock Mitigation:**
   - Isolation Forest detects atypical spikes and stockout zeros ($Z > 3.0$).
   - Anomalies are clamped to the 7-day rolling mean to prevent transient shocks from corrupting future forecasts or inflating buffer stock.

5. **Feasibility Preservation & Non-Overselling in OR-Tools CP-SAT:**
   - **Hard Constraint:** Warehouse usable inventory is never oversold: $\sum_s X_{w, s, k} \le \text{Inventory}_{w, k}$.
   - **Soft Constraint with High Penalty:** Unmet demand ($U_{s, k}$) absorbs inventory shortages when warehouse supply is less than store demand, preventing the solver from crashing into `INFEASIBLE`.
   - **Deterministic Greedy Fallback:** If the CP solver exceeds its time budget or encounters invalid configurations, a greedy heuristic returns a valid operational shipment plan.

---

## 3. Empirical Benchmark Results (219,000 Records)

Evaluated on the full 1-year daily dataset (`synthetic_sales_daily.csv`: 30 stores, 20 SKUs, 365 days):

### Demand Forecasting Benchmark (30-Day Chronological Holdout: 18,000 records)

| Model | WAPE (%) | MAE (Units) | RMSE | $R^2$ Score | Gate Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Seasonal-Naive (Baseline)** | 21.95% | 6.70 | 9.73 | 0.6566 | Baseline Reference |
| **Random Forest** | **14.99%** | **4.58** | **6.77** | **0.8337** | **APPROVED (+31.71% improvement)** |
| **LightGBM Regressor** | 15.21% | 4.64 | 6.90 | 0.8273 | **APPROVED (+30.73% improvement)** |

* **Gate Status:** `APPROVED_BY_GATE` (Random Forest beat baseline by 31.71%, far exceeding the 5% requirement).

### Stock Allocation Optimization (OR-Tools CP-SAT)

* **Solver Status:** `OPTIMAL`
* **Requested Demand:** 3,286 units
* **Allocated Units:** 3,286 units
* **Unmet Demand:** 0 units
* **Fulfillment Rate:** 100.0%
* **Modeled Transport Cost:** $443.83
* **Solver Runtime:** 0.237 seconds
* **Constraint Violations:** **0 (Guaranteed)**

---

## 4. Repository Structure

```
├── flowgrid_cli.py             # Official CLI Tool (interactive menu & subcommands)
├── prd_test_suite.py           # PRD Acceptance Test Suite & Controlled Scenarios
├── pipeline_runner.py          # Unified pipeline runner (trains, benchmarks & exports)
├── test_models.py              # Automated unit tests for ML & solver constraints
├── models/
│   ├── __init__.py
│   ├── feature_pipeline.py     # Lag & rolling feature engineering, temporal split, data sanitization
│   ├── demand_forecaster.py    # Seasonal-Naive, RF, LightGBM, and PRD 5% WAPE Gate
│   ├── anomaly_detector.py     # Isolation Forest demand shock detection & outlier clamping
│   ├── stock_optimizer.py      # Google OR-Tools CP-SAT multi-warehouse constrained allocator
│   └── static_baseline.py      # PRD-mandated static greedy baseline for scenario comparison
├── saved_models/
│   ├── demand_forecaster.joblib
│   ├── anomaly_detector.joblib
│   ├── pipeline_summary_report.json
│   └── prd_test_report.json
├── synthetic_sales_daily.csv   # 219,000-row daily retail sales dataset
└── README.md
```

---

## 5. FlowGrid CLI Tool (Problem Statement 2 Interface)

The official CLI tool supports interactive menu mode as well as headless scriptable subcommands:

```bash
# Interactive menu mode (for judges and operators)
python flowgrid_cli.py -i

# Inspect network status & warehouse/store topology
python flowgrid_cli.py status

# Run AI demand forecasting with holdout validation
python flowgrid_cli.py forecast --store STORE-001

# Solve constrained stock allocation (OR-Tools CP-SAT)
python flowgrid_cli.py optimize

# Benchmark controlled scenarios (Static Baseline vs AI Optimizer)
python flowgrid_cli.py scenario

# Run PRD Acceptance Test Suite
python flowgrid_cli.py test

# Inspect traceable decision audit trail
python flowgrid_cli.py audit
```

*(Add `--json` to any subcommand for automated API integration or grading pipelines).*

---

## 6. PRD Acceptance Test Suite (`prd_test_suite.py`)

Directly implements PRD Section 6 Functional Requirements and Section 12 Success Metrics:

| Test ID | PRD Reference | Target / Pass Condition | Measured Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-P0-01** | PRD Sec. 6.1 & 13.1 | Zero data leakage, strict chronological split, no negative sales | 0 leaks, 0 NaNs, valid temporal split | **PASS** |
| **FR-P0-02** | PRD Sec. 6.1 & 12 | ML achieves $\ge 5\%$ relative WAPE improvement over Seasonal-Naive | RF (+31.71%) vs Naive | **PASS** |
| **FR-P0-03** | PRD Sec. 6.1 & 12 | 100% hard constraints satisfied (0 warehouse overselling) | 0 violations detected | **PASS** |
| **SEC-12** | PRD Sec. 12 | $\ge 5\%$ lower objective value in $\ge 2$ of 3 controlled scenarios | Passed in 2 of 3 scenarios | **PASS** |
| **FR-P0-05** | PRD Sec. 6.1 & 6.2 | Isolation Forest shock detection & anomaly clamping | Shock isolated & clamped to mean | **PASS** |
| **FR-P0-11** | PRD Sec. 6.1 & 11 | Complete audit traceability & solver wall time $\le 10\text{s}$ | Solver latency 0.24s $\le 10\text{s}$ | **PASS** |

**Final PRD Score:** **6/6 Tests Passed (100.0% Compliance)**.

To re-train all models, benchmark WAPE, detect anomalies, optimize replenishment, and export serialized artifacts:
```bash
python pipeline_runner.py
```
