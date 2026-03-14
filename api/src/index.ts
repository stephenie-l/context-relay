import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import distillRouter from "./routes/distill.js";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/", distillRouter);

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Context Relay API running on port ${port}`);
});
