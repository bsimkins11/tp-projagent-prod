import express from "express";
import cors from "cors";

const FOLDERS = {
  agentkb: "1UaUj8726-jgnKrrFKzOR4H6YJK0E_Q5L" // <- your folder ID
};

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

// Google Drive API routes
app.get("/api/:profile/search", async (req, res) => {
  try {
    const { google } = await import("googleapis");
    const folderId = FOLDERS[req.params.profile];
    if (!folderId) return res.status(404).json({ error: "Unknown profile" });
    const q = String(req.query.q || "").trim();
    if (!q) return res.status(400).json({ error: "Missing query" });
    const limit = parseInt(req.query.limit) || 10;
    
    console.log(`Search request - Profile: ${req.params.profile}, Query: "${q}", Limit: ${limit}`);
    console.log(`Searching in folder: ${folderId}`);

    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    });
    const drive = google.drive({ version: "v3", auth });
    
    // First, let's check what files are in the folder
    const folderCheck = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      pageSize: 10,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    console.log(`Files in folder: ${JSON.stringify(folderCheck.data.files)}`);
    
    // If no files found, return the folder check results
    if (!folderCheck.data.files || folderCheck.data.files.length === 0) {
      console.log("No files found in folder, returning empty results");
      return res.json([]);
    }
    
    const resp = await drive.files.list({
      q: `'${folderId}' in parents and fullText contains '${q.replace(/'/g, "\\'")}'`,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      pageSize: limit,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
    console.log(`Search results: ${JSON.stringify(resp.data.files)}`);
    
    // Transform response to match OpenAPI schema
    const files = (resp.data.files || []).map(file => ({
      fileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      driveWebLink: file.webViewLink
    }));
    
    res.json(files);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search error", details: error.message });
  }
});

app.get("/api/:profile/file/:fileId/export", async (req, res) => {
  try {
    const { google } = await import("googleapis");
    const folderId = FOLDERS[req.params.profile];
    if (!folderId) return res.status(404).json({ error: "Unknown profile" });

    const { fileId } = req.params;
    console.log(`Export request - Profile: ${req.params.profile}, FileId: ${fileId}`);
    
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"]
    });
    const drive = google.drive({ version: "v3", auth });
    
    const { data: fileData } = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,parents,webViewLink,modifiedTime"
    });
    
    if (!(fileData.parents || []).includes(folderId)) {
      return res.status(403).json({ error: "Not in folder" });
    }

    const mt = fileData.mimeType || "";
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
      streamResp.data.on("end", () => res.json({ fileId, name: fileData.name, content }));
      streamResp.data.on("error", () => res.status(500).json({ error: "Export stream error" }));
    } else {
      const dl = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
      const content = Buffer.from(dl.data).toString("utf8");
      res.json({ fileId, name: fileData.name, content });
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Export error", details: error.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`KB middleware on :${port}`));
