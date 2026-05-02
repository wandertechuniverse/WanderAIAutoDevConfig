import { Router } from "express";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const FALLBACK_SYSTEM_PROMPT = `You are a helpful engineering assistant for the Wander AI team. 
You help with software development, architecture, and technical decisions.`;

function loadSystemPrompt(agentId: string): string {
  if (!agentId || agentId === "orchestrator") {
    const fallbackPath = join(DATA_DIR, "agents", "engineering_manager.agent.md");
    if (existsSync(fallbackPath)) {
      return readFileSync(fallbackPath, "utf-8");
    }
    return FALLBACK_SYSTEM_PROMPT;
  }

  const agentPath = join(DATA_DIR, "agents", `${agentId}.agent.md`);
  if (existsSync(agentPath)) {
    return readFileSync(agentPath, "utf-8");
  }

  return FALLBACK_SYSTEM_PROMPT;
}

router.post("/chat", async (req, res) => {
  const { agentId, messages } = req.body as {
    agentId: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const systemPrompt = loadSystemPrompt(agentId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "LLM streaming error");
    res.write(`data: ${JSON.stringify({ error: "LLM request failed" })}\n\n`);
    res.end();
  }
});

export default router;
