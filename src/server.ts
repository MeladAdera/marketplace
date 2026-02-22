// src/server.ts
import express from "express";
import dotenv from "dotenv";
import pool from "./db/database";
import cookieParser from "cookie-parser";
import helmet from "helmet"; 
import cors from "cors"; 
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.middleware"; 
import i18next, { i18nReady } from "./config/i18n.config"; // ✅ Import i18nReady
import middleware from "i18next-http-middleware";

dotenv.config();

const app = express();

app.use(helmet()); 
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// ✅ i18next Middleware
app.use(middleware.handle(i18next));

// ✅ Routes
app.use(routes); 

// ✅ Health check
app.get("/health", async (req, res) => {
  try {
    const dbResult = await pool.query("SELECT NOW() as time");
    res.json({ 
      ok: true, 
      database: "connected",
      time: dbResult.rows[0].time
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ 
      ok: false, 
      database: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// ✅ Wait for i18next AND database before starting
Promise.all([
  i18nReady,
  pool.connect()
])
.then(() => {
  console.log("✅ Database connection successful");
  console.log("✅ i18next initialized successfully");
  
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
  });
})
.catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});