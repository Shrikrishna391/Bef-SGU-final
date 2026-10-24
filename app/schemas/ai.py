from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class OllamaGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Prompt sent to the local Ollama LLM")
    model: Optional[str] = Field(default=None, description="Optional override of model name (e.g. llama3.2:latest or gemma4:12b)")
    system_prompt: Optional[str] = Field(default=None, description="System instruction prompt")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    json_format: bool = Field(default=True, description="Enforce structured JSON output format")


class OllamaGenerateResponse(BaseModel):
    model: str
    response: str
    parsed_json: Optional[Dict[str, Any]] = None
    execution_time_seconds: float
    is_fallback: bool = False


class PlanExplanationRequest(BaseModel):
    plan_code: str = Field(..., max_length=64, examples=["PLAN-SCENARIO-DIWALI-2026"])
    model: Optional[str] = Field(default=None, description="Ollama model to use")
    focus_areas: List[str] = Field(
        default_factory=lambda: ["fill_rate", "transport_cost", "expiry_risk"],
        description="Dimensions to analyze in explainability response"
    )


class PlanExplanationResponse(BaseModel):
    plan_code: str
    model_used: str
    executive_summary: str
    fill_rate_assessment: str
    cost_tradeoff_assessment: str
    perishability_risk_assessment: str
    key_recommendations: List[str]
    traceable_facts_used: Dict[str, Any]
    is_fallback: bool = False


class DisruptionParseRequest(BaseModel):
    unstructured_text: str = Field(
        ...,
        min_length=5,
        examples=["Driver Suresh (AGENT-MUM-01) reports breakdown on Expressway, delaying 150 units of SKU-PHONE-X to Pune retail store"],
        description="Natural language incident report from delivery agent, dispatcher, or traffic alert"
    )
    model: Optional[str] = None


class DisruptionParseResponse(BaseModel):
    event_type: str = Field(description="Identified event type (e.g. AGENT_UNAVAILABLE, ROUTE_DISRUPTED, DEMAND_SURGE)")
    affected_agent_codes: List[str] = Field(default_factory=list)
    affected_store_codes: List[str] = Field(default_factory=list)
    affected_skus: List[str] = Field(default_factory=list)
    estimated_delay_hours: Optional[int] = None
    severity: str = Field(default="MEDIUM", description="Assessed operational severity: LOW, MEDIUM, HIGH, CRITICAL")
    summary: str
    raw_input: str
    is_fallback: bool = False


class OllamaModelInfo(BaseModel):
    name: str
    size: Optional[int] = None
    modified_at: Optional[str] = None
    family: Optional[str] = None


class OllamaStatusResponse(BaseModel):
    status: str
    base_url: str
    configured_model: str
    available_models: List[OllamaModelInfo]
    is_connected: bool
