import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import chatRouter from "./chat";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(chatRouter);
router.use(configRouter);

export default router;
