"""
FlowGrid AI & Ollama Intelligence Router.
Provides dynamic reasoning, fact-grounded plan explainability,
incident parsing, and candidate allocation optimization via local Ollama LLMs.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.exceptions import EntityNotFoundException
from app.core.security import require_roles, AuthenticatedUser, PLANNER_ROLES, VIEWER_ROLES
from app.models.plan import DistributionPlan
from app.schemas.ai import (
    OllamaGenerateRequest,
    OllamaGenerateResponse,
    PlanExplanationRequest,
    PlanExplanationResponse,
    DisruptionParseRequest,
    DisruptionParseResponse,
    OllamaStatusResponse,
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
