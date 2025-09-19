import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => res.send("ok"));

app.get("/", (_req, res) => res.json({ message: "KB Middleware is running!" }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`KB middleware on :${port}`));
