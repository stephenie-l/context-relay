import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface StoredPacket {
  packet_id: string;
  session_id: string;
  project_id: string;
  created_at: string;
  source_model: string;
  token_count: number;
  content: {
    topic: string;
    summary: string;
    key_points: string[];
    decisions: string[];
    open_questions: string[];
    artifacts: string[];
    current_task: string;
    next_task: string;
  };
  raw_token_count: number;
  compression_ratio: number;
}

const sessionKey = (sessionId: string) => `session:${sessionId}:packets`;

export async function savePacket(packet: StoredPacket): Promise<void> {
  const key = sessionKey(packet.session_id);
  await redis.lpush(key, JSON.stringify(packet));
}

export async function getPackets(sessionId: string): Promise<StoredPacket[]> {
  const key = sessionKey(sessionId);
  const raw = await redis.lrange(key, 0, -1);
  return (raw as unknown[]).map((item) =>
    typeof item === "string" ? (JSON.parse(item) as StoredPacket) : (item as StoredPacket)
  );
}

export async function getLatestPacket(sessionId: string): Promise<StoredPacket | null> {
  const key = sessionKey(sessionId);
  const raw = await redis.lindex(key, 0);
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as StoredPacket) : (raw as StoredPacket);
}
