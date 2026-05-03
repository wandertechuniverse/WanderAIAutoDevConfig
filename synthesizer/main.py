"""
WanderAI Synthesizer Microservice — LLM Merge Engine
──────────────────────────────────────────────────────────────────────────────
Accepts raw agent output fragments from the MCP server, routes them through an
LLM acting as a Principal Staff Engineer, and returns a single unified,
production-ready code artifact.

Provider priority (first available key wins):
  1. OPENROUTER_API_KEY → OpenRouter  (openai/gpt-4o, 200+ model catalogue)
  2. OPENAI_API_KEY     → OpenAI direct  (gpt-4o)
  3. GEMINI_API_KEY     → Gemini via OpenAI-compatible endpoint  (gemini-1.5-pro)

If no key is configured, or if the LLM call fails for any reason, the service
degrades gracefully to local concatenation so the IDE never receives an error.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

# ─── Environment ──────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] synthesizer: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("synthesizer")

# ─── LLM client factory ───────────────────────────────────────────────────────

def _resolve_client() -> tuple["AsyncOpenAI | None", "str | None"]:
    """
    Resolves the best available LLM client in priority order and returns
    (client, model_id). Returns (None, None) if no provider key is configured.
    """
    if key := os.getenv("OPENROUTER_API_KEY"):
        log.info("Provider: OpenRouter  model: openai/gpt-4o")
        return AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=key,
            default_headers={
                "HTTP-Referer": "https://wanderai.replit.app",
                "X-Title": "WanderAI Synthesizer",
            },
        ), "openai/gpt-4o"

    if key := os.getenv("OPENAI_API_KEY"):
        log.info("Provider: OpenAI direct  model: gpt-4o")
        return AsyncOpenAI(api_key=key), "gpt-4o"

    if key := os.getenv("GEMINI_API_KEY"):
        log.info("Provider: Gemini (OpenAI compat)  model: gemini-1.5-pro")
        return AsyncOpenAI(
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            api_key=key,
        ), "gemini-1.5-pro"

    log.warning(
        "No LLM API key found (OPENROUTER_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY). "
        "Synthesis will use local-fallback mode."
    )
    return None, None


_LLM_CLIENT, _LLM_MODEL = _resolve_client()

# ─── System prompt ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a Principal Staff Engineer performing a final integration pass on code \
fragments produced by multiple specialist AI agents working on the same task.

Your responsibilities:
1. Read every fragment in full before writing a single line of output.
2. Resolve all conflicts:
   - Duplicate imports → keep one canonical import per module.
   - Conflicting variable, function, or class names → pick the clearest name \
and apply it consistently throughout the merged output.
   - Missing imports referenced in one fragment but defined in another → \
add them at the top of the merged file.
   - Type mismatches or interface inconsistencies → reconcile using the most \
specific, correct type.
3. Stitch the fragments into a single, coherent, production-ready code block \
that compiles or runs without modification.
4. Preserve ALL functionality from ALL fragments — never drop logic.
5. Maintain consistent formatting, indentation, and coding style throughout.
6. Add a brief inline comment only where a non-obvious conflict resolution was \
made, so future engineers understand the decision.

Output rules — these are STRICT:
- Return ONLY the merged raw code.
- Do NOT wrap the output in markdown code fences (no ```).
- Do NOT include any explanatory text, preamble, or summary.
- Do NOT say "Here is the code", "I merged...", or anything similar.
- The very first character of your response must be the first character of \
the merged code.
"""

# ─── LLM synthesis ────────────────────────────────────────────────────────────

async def llm_synthesize(fragments: list[str], task_description: str) -> str:
    """
    Sends all agent fragments to the LLM and returns the merged code string.

    Raises an exception on API error so the caller can decide how to degrade.
    """
    if _LLM_CLIENT is None:
        raise RuntimeError("No LLM client configured.")

    # Build a structured user message that gives the LLM full context
    numbered = "\n\n".join(
        f"=== Fragment {i + 1} of {len(fragments)} ===\n{frag.strip()}"
        for i, frag in enumerate(fragments)
    )

    user_message = (
        f"Task: {task_description}\n\n"
        f"You have received {len(fragments)} code fragment(s) from specialist agents. "
        f"Merge them into one unified, production-ready artifact.\n\n"
        f"{numbered}"
    )

    log.info(
        "Calling LLM  model=%s  fragments=%d  task=%r",
        _LLM_MODEL,
        len(fragments),
        task_description[:80],
    )

    response = await _LLM_CLIENT.chat.completions.create(
        model=_LLM_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": user_message},
        ],
        temperature=0.1,   # low temperature → deterministic, consistent merges
        max_tokens=8192,
    )

    merged = (response.choices[0].message.content or "").strip()

    if not merged:
        raise RuntimeError("LLM returned an empty response.")

    log.info(
        "LLM merge complete  model=%s  output_chars=%d",
        _LLM_MODEL,
        len(merged),
    )
    return merged

# ─── Local fallback ───────────────────────────────────────────────────────────

def _local_fallback(fragments: list[str], reason: str) -> str:
    """
    Concatenates fragments locally with labelled headers.
    Used when no LLM key is configured or when the LLM call fails.
    The embedded reason string tells the consumer exactly what went wrong.
    """
    divider = "─" * 72
    parts: list[str] = [
        f"// ⚠  WanderAI Synthesizer — local fallback active",
        f"// Reason: {reason}",
        f"// {divider}",
    ]
    for i, fragment in enumerate(fragments, start=1):
        parts.append(
            f"\n// ── Fragment {i} of {len(fragments)} "
            + "─" * 40
            + f"\n{fragment.strip()}"
        )
    parts.append(f"\n// {divider}")
    parts.append("// ⚠  End of local fallback output")
    return "\n".join(parts)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="WanderAI Synthesizer",
    description=(
        "LLM-powered merge engine. Accepts raw agent output fragments, "
        "resolves conflicts, and returns a single unified code artifact."
    ),
    version="2.0.0",
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
        description="Raw code/text fragments from individual agents, one string per agent.",
        examples=[["// Database Agent\nCREATE TABLE tasks (...);", "// UI Agent\nexport function TaskCard() {}"]],
    )
    task_description: str | None = Field(
        default=None,
        description="Optional task context forwarded from the MCP layer. Helps the LLM produce a more coherent merge.",
        examples=["user authentication flow with JWT and a React login screen"],
    )
    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Arbitrary pass-through context (session id, agent ids, etc.).",
    )


class SynthesizeResponse(BaseModel):
    synthesized: str = Field(..., description="Unified merged output.")
    fragment_count: int = Field(..., description="Number of fragments received.")
    synthesized_at: str = Field(..., description="ISO-8601 UTC timestamp.")
    strategy: str = Field(..., description="Synthesis strategy applied: llm-merge-v1 or local-fallback-v1.")
    model: str | None = Field(default=None, description="LLM model used, or null on local fallback.")

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str | None]:
    """Liveness probe — returns provider and model info alongside status."""
    return {
        "status": "ok",
        "service": "wander-synthesizer",
        "provider": "llm" if _LLM_CLIENT is not None else "local-fallback",
        "model": _LLM_MODEL,
    }


@app.post(
    "/synthesize",
    response_model=SynthesizeResponse,
    summary="Merge agent fragments via LLM",
    tags=["synthesis"],
)
async def synthesize(body: SynthesizeRequest) -> SynthesizeResponse:
    """
    Accepts an array of raw agent output fragments and returns a single merged
    string produced by the LLM merge engine.

    **Strategy:** `llm-merge-v1` when an LLM key is available, `local-fallback-v1`
    when the service is unconfigured or the LLM call fails.

    **Graceful degradation:** this endpoint always returns 200. If the LLM is
    unavailable, the response will use `local-fallback-v1` and the `model` field
    will be `null`. The `synthesized` field will always contain a usable result.
    """
    if not body.fragments:
        raise HTTPException(status_code=422, detail="fragments array must not be empty.")

    task_description = body.task_description or "merge agent outputs into one unified artifact"
    now = datetime.now(timezone.utc).isoformat()

    # ── Path 1: LLM merge ─────────────────────────────────────────────────────
    if _LLM_CLIENT is not None:
        try:
            merged = await llm_synthesize(body.fragments, task_description)
            return SynthesizeResponse(
                synthesized=merged,
                fragment_count=len(body.fragments),
                synthesized_at=now,
                strategy="llm-merge-v1",
                model=_LLM_MODEL,
            )
        except Exception as err:
            log.error("LLM synthesis failed, degrading to local fallback: %s", err)
            merged = _local_fallback(body.fragments, f"LLM error: {err}")
            return SynthesizeResponse(
                synthesized=merged,
                fragment_count=len(body.fragments),
                synthesized_at=now,
                strategy="local-fallback-v1",
                model=None,
            )

    # ── Path 2: no API key configured — local fallback ───────────────────────
    log.warning("No LLM client — returning local fallback for %d fragment(s).", len(body.fragments))
    merged = _local_fallback(body.fragments, "no LLM API key configured")
    return SynthesizeResponse(
        synthesized=merged,
        fragment_count=len(body.fragments),
        synthesized_at=now,
        strategy="local-fallback-v1",
        model=None,
    )


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
