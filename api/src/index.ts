import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import distillRouter from "./routes/distill.js";
import packetRouter from "./routes/packet.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/", distillRouter);
app.route("/", packetRouter);

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Context Relay API running on port ${port}`);
});
