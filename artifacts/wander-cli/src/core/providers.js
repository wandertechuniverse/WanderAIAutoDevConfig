import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';

// ─── Client factories ─────────────────────────────────────────────────────────

export function makeOpenAIClient(apiKey) {
  return new OpenAI({ apiKey });
}

export function makeGeminiClient(apiKey) {
  return new GoogleGenerativeAI(apiKey);
}

// ─── Provider resolution ──────────────────────────────────────────────────────

/**
 * Resolves the active provider from the --provider flag and available keys.
 * Returns 'openai' | 'gemini'.
 * Exits with a human-readable message if the required key is absent.
 */
export function resolveProvider(providerFlag) {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;

  if (providerFlag === 'openai') {
    if (!hasOpenAI) {
      console.error(chalk.red('\n✖  --provider openai requires OPENAI_API_KEY to be set.\n'));
      process.exit(1);
    }
    return 'openai';
  }

  if (providerFlag === 'gemini') {
    if (!hasGemini) {
      console.error(chalk.red('\n✖  --provider gemini requires GEMINI_API_KEY to be set.\n'));
      process.exit(1);
    }
    return 'gemini';
  }

  // auto: prefer OpenAI, fall back to Gemini
  if (hasOpenAI) return 'openai';
  if (hasGemini) return 'gemini';

  // validateEnv() would already have caught this, but guard anyway
  console.error(chalk.red('\n✖  No API key available. Set OPENAI_API_KEY or GEMINI_API_KEY.\n'));
  process.exit(1);
}

// ─── Fallback detection ───────────────────────────────────────────────────────

/**
 * Returns true when an OpenAI error warrants a Gemini fallback:
 *   - HTTP 429 (rate limit)
 *   - Content safety / policy block
 */
export function shouldFallback(err) {
  if (err?.status === 429) return true;
  const msg = (err?.message ?? String(err)).toLowerCase();
  return msg.includes('safety') || msg.includes('content_policy') || msg.includes('content policy');
}

// ─── OpenAI streaming ─────────────────────────────────────────────────────────

/**
 * Calls the OpenAI API. Streams tokens to stdout when streaming is enabled.
 * Returns the full assistant reply string.
 *
 * @param {import('openai').OpenAI} client
 * @param {string}  model
 * @param {Array}   messages  OpenAI-format messages array (includes system)
 * @param {boolean} stream
 */
export async function callOpenAI(client, model, messages, stream) {
  const divider = chalk.dim('─'.repeat(60));

  if (stream) {
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: 8192,
      stream: true,
    });

    let reply = '';
    console.log(divider);
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        process.stdout.write(chalk.white(delta));
        reply += delta;
      }
    }
    console.log('\n' + divider + '\n');
    return reply;
  }

  const completion = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 8192,
  });
  const reply = completion.choices[0]?.message?.content ?? '';
  console.log(divider);
  console.log(chalk.white(reply));
  console.log(divider + '\n');
  return reply;
}

// ─── Gemini streaming ─────────────────────────────────────────────────────────

/**
 * Converts OpenAI-format messages into Gemini startChat history + final user message.
 */
function toGeminiParts(messages) {
  const nonSystem = messages.filter(m => m.role !== 'system');
  const history   = nonSystem.slice(0, -1).map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMsg = nonSystem[nonSystem.length - 1]?.content ?? '';
  return { history, lastMsg };
}

/**
 * Calls the Gemini API. Streams tokens to stdout when streaming is enabled.
 * Returns the full assistant reply string.
 *
 * @param {import('@google/generative-ai').GoogleGenerativeAI} client
 * @param {string}  model
 * @param {string}  systemPrompt
 * @param {Array}   messages  OpenAI-format messages array
 * @param {boolean} stream
 */
export async function callGemini(client, model, systemPrompt, messages, stream) {
  const divider = chalk.dim('─'.repeat(60));

  const geminiModel = client.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
  });

  const { history, lastMsg } = toGeminiParts(messages);
  const chat = geminiModel.startChat({ history });

  if (stream) {
    const result = await chat.sendMessageStream(lastMsg);
    let reply = '';
    console.log(divider);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        process.stdout.write(chalk.white(text));
        reply += text;
      }
    }
    console.log('\n' + divider + '\n');
    return reply;
  }

  const result = await chat.sendMessage(lastMsg);
  const reply  = result.response.text();
  console.log(divider);
  console.log(chalk.white(reply));
  console.log(divider + '\n');
  return reply;
}
