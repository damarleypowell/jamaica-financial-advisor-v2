"""
Jamaica Financial Advisor — Python Analytics Engine

A FastAPI microservice that provides real financial analytics to the
Node.js Express server via HTTP.  All computations use scipy, numpy,
sklearn, statsmodels, and the ``ta`` technical-analysis library.

Start with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import portfolio, technical, prediction, screener

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    print("[analytics] Jamaica Financial Advisor analytics engine starting ...")
    yield
    print("[analytics] Shutting down.")


app = FastAPI(
    title="Jamaica Financial Advisor — Analytics Engine",
    version="1.0.0",
    description="Quantitative analytics microservice for portfolio optimisation, "
                "technical analysis, ML prediction, and stock screening.",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow the Express front-end on localhost:3000
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.getenv("CORS_ORIGIN", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(portfolio.router)
app.include_router(technical.router)
app.include_router(prediction.router)
app.include_router(screener.router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "jamaica-financial-advisor-analytics",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("ANALYTICS_PORT", "8000")),
        reload=True,
    )
