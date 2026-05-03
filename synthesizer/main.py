"""
WanderAI Synthesizer Microservice
──────────────────────────────────────────────────────────────────────────────
Accepts raw agent output fragments from the MCP server, merges them into a
single unified response, and returns it.

Currently implements mock synthesis logic (concatenation with comment headers).
Swap out `_mock_synthesize` for a real LLM-merge call when ready.
"""

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WanderAI Synthesizer",
    description="Merges and validates multi-agent code fragments into a unified response.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ───────────────────────────────────────────────────────────────────

class SynthesizeRequest(BaseModel):
    fragments: list[str] = Field(
        ...,
        min_length=1,
        description="Array of raw code/text fragments from individual agents.",
        examples=[["// Fragment from AgentA\nconst x = 1;", "// Fragment from AgentB\nconst y = 2;"]],
    )
    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Optional context passed through from the MCP server (agent ids, session id, etc.).",
    )


class SynthesizeResponse(BaseModel):
    synthesized: str = Field(..., description="Unified merged output.")
    fragment_count: int = Field(..., description="Number of fragments received.")
    synthesized_at: str = Field(..., description="ISO-8601 UTC timestamp.")
    strategy: str = Field(..., description="Synthesis strategy that was applied.")


# ─── Synthesis logic ──────────────────────────────────────────────────────────

def _mock_synthesize(fragments: list[str]) -> str:
    """
    Mock synthesis: concatenate fragments with labelled comment headers.

    Replace this function with a real LLM-merge or AST-aware merge when ready.
    Each fragment is wrapped in a clearly labelled block so the IDE consumer can
    still distinguish provenance while the real merger is wired up.
    """
    divider = "─" * 72
    parts: list[str] = [
        f"// ✦  WanderAI Synthesized Output  —  {len(fragments)} fragment(s)\n// {divider}",
    ]

    for idx, fragment in enumerate(fragments, start=1):
        parts.append(
            f"\n// ── Fragment {idx} of {len(fragments)} ──────────────────────────────────────\n"
            + fragment.strip()
        )

    parts.append(f"\n// {divider}\n// ✦  End of synthesized output")
    return "\n".join(parts)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    """Liveness probe — returns 200 when the service is up."""
    return {"status": "ok", "service": "wander-synthesizer"}


@app.post(
    "/synthesize",
    response_model=SynthesizeResponse,
    summary="Merge agent fragments",
    tags=["synthesis"],
)
def synthesize(body: SynthesizeRequest) -> SynthesizeResponse:
    """
    Accept an array of raw agent output fragments and return a single merged string.

    **Request body**
    - `fragments`: list of strings (required) — one entry per agent output
    - `metadata`: arbitrary dict (optional) — forwarded context from the MCP layer

    **Response**
    - `synthesized`: the merged output
    - `fragment_count`: how many fragments were received
    - `synthesized_at`: ISO-8601 UTC timestamp
    - `strategy`: which synthesis strategy was applied
    """
    if not body.fragments:
        raise HTTPException(status_code=422, detail="fragments array must not be empty.")

    merged = _mock_synthesize(body.fragments)

    return SynthesizeResponse(
        synthesized=merged,
        fragment_count=len(body.fragments),
        synthesized_at=datetime.now(timezone.utc).isoformat(),
        strategy="mock-concatenate-v1",
    )


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
