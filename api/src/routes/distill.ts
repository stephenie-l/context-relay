import { Hono } from "hono";
import { z } from "zod";
import { distillMessages } from "../distill/engine.js";
import { savePacket } from "../storage/redis.js";

const router = new Hono();

const DistillBodySchema = z.object({
  session_id: z.string(),
  source_model: z.string(),
  project_id: z.string().optional().default("proj_default"),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  compression_target_tokens: z.number().optional().default(800),
});

function generatePacketId(): string {
  const date = new Date();
  const dateStr =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8);
  return `pkt_${dateStr}_${rand}`;
}

router.post("/distill", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = DistillBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { session_id, source_model, project_id, messages, compression_target_tokens } =
    parsed.data;

  const packet_id = generatePacketId();

  let packet;
  try {
    packet = await distillMessages({
      packet_id,
      session_id,
      project_id,
      source_model,
      messages,
      compression_target_tokens,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Distillation failed";
    return c.json({ error: message }, 500);
  }

  try {
    await savePacket(packet);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage failed";
    return c.json({ error: `Failed to save packet: ${message}` }, 500);
  }

  return c.json(packet, 201);
});

export default router;
