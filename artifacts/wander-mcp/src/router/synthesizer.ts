/**
 * WanderAI Synthesizer Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends collected agent output fragments to the Python FastAPI synthesizer
 * microservice and returns a single merged string.
 *
 * IMPORTANT: MCP servers must never write to stdout — it is the protocol
 * channel. All logging here goes exclusively to stderr.
 */

// Allow override via env for local dev / Docker / remote deployments
const SYNTHESIZER_URL =
  process.env.WANDER_SYNTHESIZER_URL ?? "http://localhost:8000/synthesize";

// ─── MCP-safe logger (stderr only) ───────────────────────────────────────────

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, msg: string): void {
  const ts = new Date().toISOString();
  process.stderr.write(`[wanderai-mcp:synthesizer] [${level.toUpperCase()}] ${ts} ${msg}\n`);
}

// ─── Response shape (mirrors Python SynthesizeResponse) ──────────────────────

interface SynthesizeResponse {
  synthesized: string;
  fragment_count: number;
  synthesized_at: string;
  strategy: string;
}

// ─── Graceful fallback ────────────────────────────────────────────────────────

/**
 * When the Python service is unreachable or returns an error, concatenate the
 * fragments locally with a clear warning header so the IDE always gets something
 * useful back rather than an exception.
 */
function localFallback(fragments: string[], reason: string): string {
  const divider = "─".repeat(68);
  const lines: string[] = [
    `// ⚠  WanderAI Synthesizer unavailable — local fallback active`,
    `// Reason: ${reason}`,
    `// ${divider}`,
  ];

  for (let i = 0; i < fragments.length; i++) {
    lines.push(`\n// ── Fragment ${i + 1} of ${fragments.length} ${"─".repeat(40)}`);
    lines.push(fragments[i].trim());
  }

  lines.push(`\n// ${divider}`);
  lines.push(`// ⚠  End of local fallback output`);
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends `fragments` to the Python synthesizer and returns the merged string.
 *
 * Never throws — on any network or HTTP error it logs the problem to stderr
 * and returns a graceful local fallback so the MCP tool call always succeeds.
 *
 * @param fragments  Array of raw code / text strings from individual agents.
 * @returns          Merged output string (from synthesizer or local fallback).
 */
export async function synthesizeCode(fragments: string[]): Promise<string> {
  log("info", `Sending ${fragments.length} fragment(s) to synthesizer at ${SYNTHESIZER_URL}`);

  try {
    const res = await fetch(SYNTHESIZER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fragments }),
      signal: AbortSignal.timeout(10_000), // 10 s hard timeout
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable body)");
      log("error", `Synthesizer returned HTTP ${res.status}: ${body}`);
      return localFallback(fragments, `HTTP ${res.status} from synthesizer`);
    }

    const data = (await res.json()) as SynthesizeResponse;
    log(
      "info",
      `Synthesis complete — strategy: ${data.strategy}, ` +
        `fragments: ${data.fragment_count}, at: ${data.synthesized_at}`,
    );
    return data.synthesized;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Distinguish "service is simply offline" from unexpected errors
    const isOffline =
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("TimeoutError") ||
      msg.includes("AbortError");

    log(
      isOffline ? "warn" : "error",
      isOffline
        ? `Synthesizer offline (${SYNTHESIZER_URL}) — using local fallback. Detail: ${msg}`
        : `Unexpected synthesizer error: ${msg}`,
    );

    return localFallback(
      fragments,
      isOffline ? `synthesizer offline — start with: cd synthesizer && python main.py` : msg,
    );
  }
}
