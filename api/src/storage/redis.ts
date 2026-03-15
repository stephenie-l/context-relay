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
const packetKey = (packetId: string) => `packet:${packetId}`;

export async function savePacket(packet: StoredPacket): Promise<void> {
  await Promise.all([
    redis.set(packetKey(packet.packet_id), JSON.stringify(packet)),
    redis.lpush(sessionKey(packet.session_id), JSON.stringify(packet)),
  ]);
}

export async function getPacketById(packetId: string): Promise<StoredPacket | null> {
  const raw = await redis.get(packetKey(packetId));
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as StoredPacket) : (raw as StoredPacket);
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
