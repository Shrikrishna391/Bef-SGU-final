from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.exceptions import register_exception_handlers
from app.api.routes import health
from app.db.session import check_db_connection

# Initialize centralized logging with sensitive data sanitization
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Performs readiness check on startup without automatically altering schema.
    Database migrations are kept separate and managed via Alembic.
    """
    logger.info(
        "Starting %s [version: %s, env: %s]",
        settings.PROJECT_NAME,
        settings.VERSION,
        settings.ENVIRONMENT,
    )
    logger.info("Configured database: %s", settings.sanitized_database_url)

    # Perform startup connection verification
    is_ready, _ = check_db_connection()
    if is_ready:
        logger.info("Authoritative database connectivity verified.")
        try:
            import app.models  # noqa: F401
            from app.db.base import Base
            from app.db.session import engine
            Base.metadata.create_all(bind=engine)
            logger.info("Authoritative database schema initialized.")
        except Exception as e:
            logger.warning("Database schema auto-init notice: %s", e)
    else:
        logger.warning(
            "Database connectivity check failed during startup. "
            "Service will start, but readiness checks will fail until DB is online."
        )


    yield

    logger.info("Shutting down %s.", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "FlowGrid: AI-powered distribution intelligence and inventory optimization system. "
        "Enforces the backend as the single authority for inventory allocation and commitment."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Register secure centralized exception handlers
register_exception_handlers(app)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
from app.api.v1.router import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(api_router, include_in_schema=False)  # Direct route aliases without /api/v1 prefix

# Mount HETVAYA Chatbot Package Router
try:
    from hetvaya_chatbot_package.backend.router import router as chatbot_router
    app.include_router(chatbot_router, prefix="/api")
    app.include_router(chatbot_router, prefix=settings.API_V1_STR)
    
    @app.post("/chat", include_in_schema=False)
    def chat_root_alias(payload: dict):
        from hetvaya_chatbot_package.backend.chat_service import ProductChatIntelligenceService
        from hetvaya_chatbot_package.backend.schemas import ChatQueryRequest
        req = ChatQueryRequest(**payload)
        return ProductChatIntelligenceService.process_chat_query(payload=req, db=None)
except Exception as e:
    logger.warning("Notice on mounting hetvaya_chatbot_package router: %s", e)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} Backend",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "authoritative_rule": "Backend is the single authority for plan commitment",
    }
