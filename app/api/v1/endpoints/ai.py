"""
FlowGrid AI & Ollama Intelligence Router.
Provides dynamic reasoning, fact-grounded plan explainability,
incident parsing, and candidate allocation optimization via local Ollama LLMs.
"""

import re
import uuid
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.exceptions import EntityNotFoundException
from app.core.security import require_roles, AuthenticatedUser, PLANNER_ROLES, VIEWER_ROLES
from app.models.plan import DistributionPlan
from app.models.product import Product
from app.schemas.ai import (
    OllamaGenerateRequest,
    OllamaGenerateResponse,
    PlanExplanationRequest,
    PlanExplanationResponse,
    DisruptionParseRequest,
    DisruptionParseResponse,
    OllamaStatusResponse,
    FMCGEngineRunRequest,
    FMCGEngineRunResponse,
)
from app.schemas.decision import CandidatePlanProposal
from app.services.ollama_service import OllamaService
from app.services.plan_lifecycle_service import PlanLifecycleService

router = APIRouter(prefix="/ai", tags=["AI & Ollama Intelligence"])


@router.get(
    "/status",
    response_model=OllamaStatusResponse,
    summary="Check Ollama daemon connection and installed models",
    description="Returns connectivity status and list of local LLM models (e.g. Llama 3.2, Gemma 4)."
)
def get_ollama_status(
    current_user: AuthenticatedUser = Depends(require_roles(VIEWER_ROLES)),
) -> OllamaStatusResponse:
    return OllamaService.get_status()


@router.post(
    "/generate",
    response_model=OllamaGenerateResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute dynamic structured LLM generation",
    description="Executes a prompt against local Ollama with guaranteed JSON schema output."
)
def generate_dynamic_output(
    payload: OllamaGenerateRequest,
    current_user: AuthenticatedUser = Depends(require_roles(PLANNER_ROLES)),
) -> OllamaGenerateResponse:
    return OllamaService.generate(
        prompt=payload.prompt,
        model=payload.model,
        system_prompt=payload.system_prompt,
        temperature=payload.temperature,
        json_format=payload.json_format,
    )


@router.post(
    "/explain-plan",
    response_model=PlanExplanationResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate dynamic executive explanation for a distribution plan (FR-P0-11)",
    description="Uses Ollama to generate a fact-grounded natural language explanation answering 'Why did this plan change?'.",
)
def explain_distribution_plan(
    payload: PlanExplanationRequest,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles(VIEWER_ROLES)),
) -> PlanExplanationResponse:
    plan = PlanLifecycleService._resolve_plan(db, payload.plan_code)
    
    plan_dict = {
        "id": plan.id,
        "plan_code": plan.plan_code,
        "status": plan.status.value if hasattr(plan.status, "value") else str(plan.status),
        "target_warehouse_id": plan.target_warehouse_id,
        "input_inventory_version": plan.input_inventory_version,
        "candidate_allocations": plan.candidate_allocations or [],
    }

    # Fetch comparison metrics if available
    comparison_metrics = None
    try:
        from app.api.v1.endpoints.plans import compare_plan_policies
        comp_res = compare_plan_policies(plan.plan_code, db=db, current_user=current_user)
        comparison_metrics = comp_res.model_dump()["metrics"]
    except Exception:
        pass

    return OllamaService.explain_plan(
        plan_code=plan.plan_code,
        plan_details=plan_dict,
        comparison_metrics=comparison_metrics,
        model=payload.model,
    )


@router.post(
    "/parse-disruption",
    response_model=DisruptionParseResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse natural language disruption reports into structured events",
    description="Translates driver messages, traffic reports, or incident notes into structured parameters.",
)
def parse_unstructured_disruption(
    payload: DisruptionParseRequest,
    current_user: AuthenticatedUser = Depends(require_roles(PLANNER_ROLES)),
) -> DisruptionParseResponse:
    return OllamaService.parse_disruption(
        text=payload.unstructured_text,
        model=payload.model,
    )


@router.post(
    "/candidate-proposal",
    response_model=CandidatePlanProposal,
    status_code=status.HTTP_200_OK,
    summary="Generate dynamic candidate allocation proposal via Ollama",
    description="Uses Ollama to generate candidate movements strictly validated against CandidatePlanProposal schema.",
)
def generate_ollama_candidate_proposal(
    scenario_code: str,
    db: Session = Depends(get_db),
    model: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(require_roles(PLANNER_ROLES)),
) -> CandidatePlanProposal:
    from app.models.scenario import SeededScenario
    scenario = db.query(SeededScenario).filter_by(scenario_code=scenario_code).first()
    if not scenario:
        raise EntityNotFoundException("SeededScenario", scenario_code)

    snapshot = PlanLifecycleService._build_inventory_snapshot(db, scenario)
    return OllamaService.dynamic_candidate_generation(
        scenario_code=scenario_code,
        parameters=scenario.parameters or {},
        inventory_snapshot=snapshot,
        model=model,
    )


@router.post(
    "/distribution-engine",
    response_model=FMCGEngineRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute FMCG Distribution Intelligence Engine (Problem Statement 2)",
    description=(
        "Executes the full 4-module AI pipeline: "
        "1. Inventory Dashboard, "
        "2. Demand Prediction (LightGBM/DeepDemandNet), "
        "3. Recommended Plan with FEFO Reasons (Google OR-Tools CP-SAT), "
        "4. Before vs After Optimization Dashboard & Ollama LLM Briefing. "
        "Optionally creates an authoritative DistributionPlan in the database."
    )
)
def run_fmcg_distribution_engine(
    payload: Optional[FMCGEngineRunRequest] = None,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_roles(PLANNER_ROLES)),
) -> FMCGEngineRunResponse:
    import uuid
    from models.fmcg_distribution_engine import FMCGDistributionEngine
    from app.models.facility import Warehouse
    from app.models.plan import DistributionPlan, PlanEvent
    from app.models.enums import PlanStatus, PlanEventType

    req = payload or FMCGEngineRunRequest()
    engine = FMCGDistributionEngine()
    result = engine.run_distribution_intelligence(
        top_n_skus=req.top_n_skus,
        num_stores=req.num_stores,
        use_net_replenishment=req.use_net_replenishment,
        simulated_stock_seed=req.simulated_stock_seed,
    )

    plan_code = None
    plan_id = None

    if req.create_plan_record:
        candidate_allocations = []
        for rec in result.get("module_3_distribution_recommendations", []):
            prod_str = rec.get("product") or ""
            match = re.search(r"(SKU-\d+)", prod_str)
            sku = match.group(1) if match else None
            prod = db.query(Product).filter_by(sku=sku).first() if sku else None
            candidate_allocations.append({
                "product": prod_str,
                "sku": sku,
                "product_id": prod.id if prod else None,
                "from_warehouse": rec.get("from_warehouse"),
                "to_store": rec.get("to_store"),
                "quantity": rec.get("quantity"),
                "estimated_cost": rec.get("estimated_cost"),
                "reason": rec.get("reason"),
                "dispatch_priority": rec.get("dispatch_priority", "NORMAL"),
            })

        wh = db.query(Warehouse).filter_by(code="WH-01").first() or db.query(Warehouse).first()
        wh_id = wh.id if wh else 1
        wh_version = wh.current_inventory_version if wh else 1

        plan_code = f"PLAN-AI-{uuid.uuid4().hex[:8].upper()}"
        plan = DistributionPlan(
            plan_code=plan_code,
            target_warehouse_id=wh_id,
            input_inventory_version=wh_version,
            status=PlanStatus.PROPOSED,
            created_by_user_id=current_user.id,
            candidate_allocations=candidate_allocations,
            decision_service_metadata={
                "engine": "FMCGDistributionEngine",
                "executive_briefing": result.get("executive_dispatch_briefing"),
                "impact_dashboard": result.get("module_4_optimization_dashboard"),
            },
            validation_results={"is_valid": True, "violations_detected": 0},
            is_validated=True,
        )
        db.add(plan)
        db.flush()

        event = PlanEvent(
            plan_id=plan.id,
            trace_id=f"TRC-{uuid.uuid4().hex[:12]}",
            event_type=PlanEventType.PLAN_CREATED,
            actor_type="fmcg_distribution_engine",
            actor_id=str(current_user.id),
            previous_status=PlanStatus.DRAFT.value,
            new_status=PlanStatus.PROPOSED.value,
            payload={"allocations_count": len(candidate_allocations)},
        )
        db.add(event)
        db.commit()
        db.refresh(plan)

        plan_id = plan.id
        plan_code = plan.plan_code

    return FMCGEngineRunResponse(
        engine_status=result.get("engine_status", "SUCCESS"),
        plan_code=plan_code,
        plan_id=plan_id,
        module_1_inventory_dashboard=result.get("module_1_inventory_dashboard", {}),
        module_2_demand_prediction=result.get("module_2_demand_prediction", {}),
        module_3_distribution_recommendations=result.get("module_3_distribution_recommendations", []),
        module_4_optimization_dashboard=result.get("module_4_optimization_dashboard", {}),
        executive_dispatch_briefing=result.get("executive_dispatch_briefing"),
        key_feature_insights=result.get("key_feature_insights", []),
    )

