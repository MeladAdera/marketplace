// src/server.ts
import express from "express";
import dotenv from "dotenv";
import pool from "./db/database";
import { redisIsReady } from "./db/redis";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware";
import i18next, { i18nReady } from "./config/i18n.config";
import middleware from "i18next-http-middleware";

dotenv.config();

const app = express();

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// i18next middleware
app.use(middleware.handle(i18next));

// routes
app.use(routes);

// health check
app.get("/health", async (req, res) => {
  try {
    const [dbResult, redisOk] = await Promise.all([
      pool.query("SELECT NOW() as time"),
      redisIsReady(),
    ]);

    res.json({
      ok: true,
      database: "connected",
      redis: redisOk ? "connected" : "disconnected",
      time: dbResult.rows[0].time,
    });
  } catch (error) {
    console.error("Database connection error:", error);
    const redisOk = await redisIsReady();
    res.status(500).json({
      ok: false,
      database: "disconnected",
      redis: redisOk ? "connected" : "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// wait for i18next and database
Promise.all([i18nReady, pool.query("SELECT 1")])
  .then(async () => {
    console.log("✅ Database connection successful");
    console.log("✅ i18next initialized successfully");

    const redisOk = await redisIsReady();
    if (redisOk) {
      console.log("✅ Redis connected");
    } else {
      console.warn("⚠️ Redis not available — caching disabled");
    }

    const PORT = process.env.PORT || 4000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });