import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (_req, res) => res.json({ 
  message: "KB Middleware is running!", 
  status: "healthy",
  endpoints: ["/healthz", "/test", "/api/:profile/search", "/api/:profile/file/:fileId/export"]
}));

app.get("/healthz", (_req, res) => res.send("ok"));

// Test route
app.get("/test", (_req, res) => res.json({ 
  message: "Test endpoint working!",
  timestamp: new Date().toISOString(),
  googleAuth: "Not configured yet"
}));

// Placeholder routes for Google Drive API (will return errors until auth is set up)
app.get("/api/:profile/search", async (req, res) => {
  res.status(503).json({ 
    error: "Google Drive authentication not configured",
    message: "Please add service account credentials to enable this feature"
  });
});

app.get("/api/:profile/file/:fileId/export", async (req, res) => {
  res.status(503).json({ 
    error: "Google Drive authentication not configured",
    message: "Please add service account credentials to enable this feature"
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`KB middleware on :${port}`));
