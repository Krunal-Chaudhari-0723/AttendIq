import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";

const mainRouter = Router();

mainRouter.use("/api", healthRouter);
mainRouter.use("/api", authRouter);

export default mainRouter;
