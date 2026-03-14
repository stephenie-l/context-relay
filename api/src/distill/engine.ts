import Anthropic from "@anthropic-ai/sdk";
import type { StoredPacket } from "../storage/redis.js";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a context distillation engine. Given a conversation, extract and return ONLY a JSON object with these exact fields:

{
  "topic": "The main subject of the conversation (concise phrase)",
  "summary": "A paragraph summarizing what was discussed and accomplished",
  "key_points": ["Array of the most important facts or conclusions"],
  "decisions": ["Array of decisions that were made"],
  "open_questions": ["Array of unresolved questions or issues"],
  "artifacts": ["Array of code snippets, files, or outputs produced (describe them)"],
  "current_task": "What the user is currently working on",
  "next_task": "The logical next step to continue this work"
}

Return ONLY valid JSON. No markdown fences, no explanation, no preamble.`;

export interface DistillInput {
  packet_id: string;
  session_id: string;
  project_id: string;
  source_model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  compression_target_tokens: number;
}

export async function distillMessages(input: DistillInput): Promise<StoredPacket> {
  const conversationText = input.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const userMessage = `Distill this conversation into the required JSON format. Target summary length: ~${input.compression_target_tokens} tokens.\n\n${conversationText}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawTokenCount = response.usage.input_tokens;
  const outputTokenCount = response.usage.output_tokens;

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock) {
    throw new Error("No text block in Claude response");
  }

  const jsonText = textBlock.text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();

  let content: StoredPacket["content"];
  try {
    content = JSON.parse(jsonText) as StoredPacket["content"];
  } catch {
    throw new Error(`Failed to parse distillation JSON: ${jsonText}`);
  }

  const compressionRatio =
    rawTokenCount > 0
      ? parseFloat((1 - outputTokenCount / rawTokenCount).toFixed(4))
      : 0;

  return {
    packet_id: input.packet_id,
    session_id: input.session_id,
    project_id: input.project_id,
    created_at: new Date().toISOString(),
    source_model: input.source_model,
    token_count: outputTokenCount,
    content,
    raw_token_count: rawTokenCount,
    compression_ratio: compressionRatio,
  };
}
