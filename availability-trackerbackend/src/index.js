import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.js";
import { authRoutes } from "./routes/auth.js";
import { availabilityRoutes } from "./routes/availability.js";
import { meetingRoutes } from "./routes/meeting.js";
import { adminRoutes } from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://availabilitytrackerfrontend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/admin", adminRoutes);

app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, database: "disconnected", error: err.message });
  }
});

app.post("/debug-token", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.json({ error: "no token" });

  const JWT_SECRET = process.env.JWT_SECRET;
  let decoded = null, err = null;

  try { 
    decoded = jwt.verify(token, JWT_SECRET); 
  } catch(e) { 
    err = e.message; 
  }

  const raw = jwt.decode(token);

  res.json({
    raw_payload: raw,
    verify_with_JWT_SECRET: decoded || err,
    JWT_SECRET_set: !!JWT_SECRET,
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully 🚀");
  } catch (error) {
    console.error("Database connection failed ❌:", error.message);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();