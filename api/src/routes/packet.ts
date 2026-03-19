import { Hono } from "hono";
import { getPacketById, getPackets } from "../storage/redis.js";

const router = new Hono();

router.get("/packet/:id", async (c) => {
  const packet = await getPacketById(c.req.param("id"));
  if (!packet) return c.json({ error: "Packet not found" }, 404);
  return c.json(packet);
});

router.get("/packets", async (c) => {
  const session_id = c.req.query("session_id");
  if (!session_id) return c.json({ error: "session_id query param is required" }, 400);
  const packets = await getPackets(session_id);
  return c.json(packets);
});

router.post("/packet/:id/send", async (c) => {
  const packet = await getPacketById(c.req.param("id"));
  if (!packet) return c.json({ error: "Packet not found" }, 404);

  const { topic, summary, key_points, decisions, open_questions, current_task, next_task } =
    packet.content;

  const lines = [
    "Here is context from a prior conversation.",
    "",
    `Topic: ${topic}`,
    `Summary: ${summary}`,
  ];

  if (key_points.length > 0) {
    lines.push("", "Key Points:");
    key_points.forEach((p) => lines.push(`- ${p}`));
  }

  if (decisions.length > 0) {
    lines.push("", "Key Decisions:");
    decisions.forEach((d) => lines.push(`- ${d}`));
  }

  if (open_questions.length > 0) {
    lines.push("", "Open Questions:");
    open_questions.forEach((q) => lines.push(`- ${q}`));
  }

  if (current_task) lines.push("", `Current Task: ${current_task}`);
  if (next_task) {
    lines.push("", `Next Task: ${next_task}`);
    lines.push(
      "",
      "Please continue working on this. Start with the next task listed above and take action directly — do not ask for clarification."
    );
  }

  return c.json({ formatted: lines.join("\n") });
});

export default router;
