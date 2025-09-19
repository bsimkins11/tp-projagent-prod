import express from "express";
import cors from "cors";
import { google } from "googleapis";

const FOLDERS = {
  agentkb: "1hpJknbStDhT1Um3GyMM-srH9Q-Cyvsnp" // <- your folder ID
};

const app = express();
app.use(cors());
app.use(express.json());

async function driveClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    });
    const client = await auth.getClient();
    return google.drive({ version: "v3", auth: client });
  } catch (error) {
    console.error("Google Drive authentication failed:", error.message);
    throw new Error("Google Drive authentication failed. Please check service account credentials.");
  }
}

async function verifyInFolder(drive, fileId, folderId) {
  const { data } = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,parents,webViewLink,modifiedTime"
  });
  return { ok: (data.parents || []).includes(folderId), meta: data };
}

app.get("/api/:profile/search", async (req, res) => {
  try {
    const folderId = FOLDERS[req.params.profile];
    if (!folderId) return res.status(404).json({ error: "Unknown profile" });
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query" });

    const drive = await driveClient();
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and fullText contains '${q.replace(/'/g, "\\'")}'`,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      pageSize: 10
    });
    res.json(resp.data.files || []);
  } catch (e) {
    res.status(500).json({ error: "Search error" });
  }
});

app.get("/api/:profile/file/:fileId/export", async (req, res) => {
  try {
    const folderId = FOLDERS[req.params.profile];
    if (!folderId) return res.status(404).json({ error: "Unknown profile" });

    const { fileId } = req.params;
    const drive = await driveClient();
    const { ok, meta } = await verifyInFolder(drive, fileId, folderId);
    if (!ok) return res.status(403).json({ error: "Not in folder" });

    const mt = meta.mimeType || "";
    if (mt.startsWith("application/vnd.google-apps")) {
      const mimeOut = mt.includes("document")
        ? "text/plain"
        : mt.includes("spreadsheet")
        ? "text/tab-separated-values"
        : "text/plain";
      const streamResp = await drive.files.export(
        { fileId, mimeType: mimeOut },
        { responseType: "stream" }
      );
      let content = "";
      streamResp.data.on("data", c => (content += c));
      streamResp.data.on("end", () => res.json({ fileId, name: meta.name, content }));
      streamResp.data.on("error", () => res.status(500).json({ error: "Export stream error" }));
    } else {
      const dl = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
      const content = Buffer.from(dl.data).toString("utf8");
      res.json({ fileId, name: meta.name, content });
    }
  } catch {
    res.status(500).json({ error: "Export error" });
  }
});

// Root route
app.get("/", (_req, res) => res.json({ 
  message: "KB Middleware is running!", 
  status: "healthy",
  endpoints: ["/healthz", "/api/:profile/search", "/api/:profile/file/:fileId/export"]
}));

app.get("/healthz", (_req, res) => res.send("ok"));

// Test route that doesn't require Google Drive auth
app.get("/test", (_req, res) => res.json({ 
  message: "Test endpoint working!",
  timestamp: new Date().toISOString(),
  googleAuth: "Not tested"
}));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`KB middleware on :${port}`));
