import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

const DATA_DIR = join(process.cwd(), "data");

router.get("/agents", (req, res) => {
  try {
    const configPath = join(DATA_DIR, "agents_config.json");
    const raw = readFileSync(configPath, "utf-8");
    const agents = JSON.parse(raw);
    res.json(agents);
  } catch (err) {
    req.log.error({ err }, "Failed to read agents config");
    res.status(500).json({ error: "Failed to load agents" });
  }
});

export default router;
