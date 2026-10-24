# HETVAYA (हेत्वय)

![HETVAYA Distribution Intelligence](docs/media/hetvaya_v3_hero_render.jpg)

**AI Marginal-Value Allocation & Demand Intelligence Engine for Indian FMCG Traditional Trade**

---

## 📌 The Pitch & Problem

In India's 13M+ traditional kirana store networks, FMCG distributors operate on razor-thin gross margins of **3% to 5%**. In this economic reality:
- **A single expired case wipes out the net profit of 20 to 25 fulfilled sales.**
- **Blunt spreadsheet heuristics** (shipping last week's sales to the nearest retailer from whatever warehouse is closest) result in catastrophic dock rejections (short shelf-life arrivals), severe stockouts, and unnecessary warehouse write-offs.
- **Operations textbook baselines** (FEFO + safety stock order-up-to rules) enforce blind dispatch that ignores transit lateness, store backroom capacity, and marginal SKU revenue density under supply shocks.

**HETVAYA** replaces static rules with an explainable, in-memory **greedy marginal-value knapsack allocation heuristic**. By evaluating piecewise quantile demand revenue against secondary freight and holding costs, enforcing hard arrival shelf-life gating ($\ge 70\%$), and accounting for transit lateness penalties, HETVAYA cuts stockouts by **50.6%** and reduces lost kirana margin by **72.0%** compared to textbook safety stock policies.

---

## 📊 Audited Benchmark Results (20 Simulated Networks, 9 Cycles Each)

The simulation rigorously scores 3 competing distribution policies over **identical, frozen weekly demand realizations** where true consumer demand is withheld from each policy until dispatches are locked:

1. **Policy 1: Current Practice (Spreadsheet Quo)**: Ship last week's sales, single nearest warehouse, newest batch first (LIFO/FIFO), no arrival shelf-life verification or store space checks.
2. **Policy 2: Operations Textbook (Strong Baseline)**: Periodic review $(R, S)$ order-up-to policy ($S = \mu_{R+L} + 1.65\sigma_{R+L}$), nearest eligible warehouse, earliest expiry first (FEFO) with dispatch shelf-life checking and store backroom capacity enforcement.
3. **Policy 3: HETVAYA Engine**: Greedy marginal-value knapsack allocation heuristic, kirana-specific minimum arrival shelf-life pre-filtering, lateness-aware cross-warehouse sourcing, and backroom storage limit enforcement.

### Comparative Evaluation Table (Simulated Results)

| Metric | Current Practice | Textbook Baseline | HETVAYA Engine | vs Current Practice | vs Textbook Baseline |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Stockout Units (mean)** | 23,272 | 19,364 | **9,569** | **−58.9%** | **−50.6%** *(simulated)* |
| **Fill Rate (%)** | 59.1% | 66.0% | **83.2%** | **+24.1 pt** | **+17.2 pt** *(simulated)* |
| **Total Waste (Units)** | 12,969 | 9,627 | **8,703** | **−32.9%** | **−9.6%** *(simulated)* |
| - *Expired in Warehouse* | 7,616 | 9,627 | 8,703 | +1,087 | −924 *(simulated)* |
| - *Rejected at Kirana Dock* | 5,353 | 0 | **0** | **−100.0%** | 0.0% |
| **Transport Freight (₹)** | ₹45,670 | ₹44,410 | **₹52,694** | **+15.4%** | **+18.7%** *(trade-off)* |
| **Lost Margin (₹)** | ₹1,042,248 | ₹866,476 | **₹242,261** | **−76.8%** | **−72.0%** *(simulated)* |
| **Completed Feasible Solves** | 180 / 180 | 180 / 180 | **180 / 180 (100%)** | — | — |
| **Solve Time (ms)** | — | — | **p50: 0.51 ms, p95: 0.89 ms** | — | — |

> **Freight Trade-Off Disclosure**: HETVAYA exhibits a **+18.7% increase in secondary freight cost** (+₹8,284 vs Textbook Baseline). This is an intentional economic trade-off: HETVAYA routes stock from secondary depots (e.g. Satara or Kolhapur) when the local depot holds inventory that fails kirana shelf-life thresholds or is stock-constrained. Spending an extra ₹8.3k on freight directly prevents store stockouts to save **₹624,214 in net kirana margin**.

---

### Paired Statistical Significance (20 Seeds, $df=19$, 95% Confidence Interval)

For every simulated network seed ($i = 0 \dots 19$), the per-seed difference was paired: $d_i = \text{HETVAYA}_i - \text{Textbook}_i$. All tests are two-tailed Student's t-intervals with critical value $t_{19, 0.975} = 2.093024$:

| Metric | Mean Difference ($\bar{d}$) | % Difference | 95% Confidence Interval | Verdict |
| :--- | :---: | :---: | :---: | :---: |
| **Stockout Units** | −9,794.5 units | −50.6% | **[−10,461.5, −9,127.5] units** | **SIGNIFICANT** ($p < 0.001$) |
| **Fill Rate** | +17.2 pt | +26.1% | **[+16.1 pt, +18.4 pt]** | **SIGNIFICANT** ($p < 0.001$) |
| **Total Expiry Waste** | −924.4 units | −9.6% | **[−1,566.5, −282.2] units** | **SIGNIFICANT** ($p = 0.007$) |
| **Secondary Freight Cost** | +₹8,284.4 | +18.7% | **[+₹7,639.4, +₹8,929.4]** | **SIGNIFICANT** ($p < 0.001$) |
| **Lost Kirana Margin** | −₹624,214.3 | −72.0% | **[−₹662,695.1, −₹585,733.4]** | **SIGNIFICANT** ($p < 0.001$) |

*All 5 confidence intervals strictly exclude zero, confirming statistical significance across seeds.*

---

## 🔬 Methodology Note & Allocation Engine

HETVAYA's allocation engine ([`src/services/optimizationEngine.ts`](src/services/optimizationEngine.ts)) uses an in-memory greedy marginal-value knapsack allocation heuristic:

1. **Kirana Arrival Shelf-Life Hard Gating**: Any warehouse batch whose projected shelf-life percentage upon arrival ($\frac{\text{Expiry Date} - \text{Current Date} - \text{Transit Time}}{\text{Total Shelf Life}}$) falls below the store's contractual threshold ($\ge 70\%$) is eliminated before allocation.
2. **Delivery Lateness Cost Valuation**: Transit delays beyond the store's current days-of-cover incur an explicit lateness penalty ($C_{\text{late}} = \text{Case Margin} \times \frac{\min(\text{Lateness Days}, 7)}{7}$).
3. **Marginal Value Knapsack Tiers**: For each candidate case $c$, expected marginal revenue is estimated via quantile probability curves ($p_i \in [0.05, 0.95]$) and probability of subsequent sale before expiry ($g_i$).
4. **Marginal Density Priority**: All store candidates are sorted by marginal density:
   $$\text{Density} = \frac{\text{Expected Case Margin} - (\text{Route Freight} + \text{Holding Cost})}{\text{Space Per Case}}$$
   High-probability base cases across all SKUs are prioritized over low-probability buffer cases, strictly obeying backroom case storage limits.

---

## 🏗️ System Architecture & Tech Stack

```
d:\HACKTHON\
├── src/
│   ├── components/           # Persona-based views & interactive UI
│   │   ├── PlanGeneratorView.tsx       # J3 Planner console & 409 re-plan
│   │   ├── ReasonCardModal.tsx         # Explainable AI marginal tier inspector
│   │   ├── BaselineComparisonView.tsx  # J6 Interactive benchmark charts (Seeds 0-19)
│   │   ├── ForecastReviewView.tsx      # J2 Quantile fan chart (p10-p95)
│   │   ├── KiranaRetailerView.tsx      # J5 Offline POS & EN/HI/MR multi-language toggle
│   │   ├── WarehouseOpsView.tsx        # J4 FEFO digital pick slips & count adjustments
│   │   ├── ImportStudioView.tsx        # J1 Master data import & 5% error rule
│   │   ├── AdminHealthView.tsx         # Health & service failure injection
│   │   ├── HeroBanner.tsx              # Top context & audited KPI callouts
│   │   └── DemoWalkthroughModal.tsx    # 3-minute hackathon judge walkthrough
│   ├── services/
│   │   ├── optimizationEngine.ts       # Shared greedy marginal-value allocation engine
│   │   └── offlineSyncService.ts       # Client-side offline event queue & reconciliation
│   ├── data/
│   │   └── mockData.ts                 # Master FMCG catalogue, depots, kirana stores
│   ├── types/
│   │   └── index.ts                    # Complete TypeScript definitions
│   ├── App.tsx                         # State coordinator & tab switcher
│   └── main.tsx                        # React 19 entry point
├── scripts/
│   └── benchmark.ts                    # Audited 20-seed simulation runner
├── results/
│   └── benchmark.json                  # Machine-readable verified benchmark outputs
├── docs/
│   └── media/                          # Visual assets & hero render
├── vite.config.ts                      # Vite 8 config with Tailwind CSS v4
└── package.json
```

- **Frontend Framework**: React 19 + TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 + Glassmorphism tokens
- **Visualizations**: Recharts 2 (Quantile Fan Charts, Side-by-Side Benchmark Bars)
- **Icons**: Lucide React
- **Build Tool**: Vite 8

---

## ⚡ Exact Run Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Launch Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The app starts with zero console errors.

### 3. Run the Audited Benchmark Simulation
```bash
npm run benchmark
```
Executes `scripts/benchmark.ts` across 20 synthetic networks (seeds 0–19) over 9 weekly replenishment cycles (180 decision runs), performs paired t-tests, and updates [`results/benchmark.json`](results/benchmark.json).

### 4. Build for Production
```bash
npm run build
```
Typechecks via `tsc -b` and produces optimized assets in `dist/`.

---

## ⚠️ Limitations & Disclosures

- **Synthetic Network Data**: Retailer demand profiles, distributor depots, and network seeds are calibrated via a deterministic PRNG using typical FMCG distribution statistics, rather than production SAP/ERP feeds.
- **Route Freight Model**: Freight is evaluated as per-case route transit costs with delivery lateness penalties, rather than multi-stop combinatorial vehicle routing (CVRP) or stepped full-truckload (FTL/LTL) tariff tiers.
- **Offline Event Queue Prototype**: Offline POS transaction capture and resilient sync are implemented in-browser via local storage event queuing and timestamp-based conflict reconciliation; this is a software demonstration prototype rather than a production physical Android POS terminal deployment.
- **Heuristic Allocation vs Exact MIP Solvers**: The allocation engine implements an in-memory greedy marginal-value knapsack heuristic with quantile revenue curves, rather than an external mixed-integer programming (MIP) solver library (e.g. SCIP or Gurobi).

---

## 👥 Team & License

Developed for the **SGU Triwizathon Hackathon (Problem Statement 2: FMCG Distribution Intelligence & Inventory Optimization Engine)**.

Distributed under the [MIT License](LICENSE).
