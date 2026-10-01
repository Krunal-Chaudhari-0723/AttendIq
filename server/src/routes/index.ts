import { Router } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import teacherRouter from "./teacher";
import studentRouter from "./student";
import notificationRouter from "./notifications";
import profileRouter from "./profile";

const mainRouter = Router();

mainRouter.use("/api", healthRouter);
mainRouter.use("/api", authRouter);
mainRouter.use("/api/admin", adminRouter);
mainRouter.use("/api/teacher", teacherRouter);
mainRouter.use("/api/student", studentRouter);
mainRouter.use("/api/notifications", notificationRouter);
mainRouter.use("/api/profile", profileRouter);



export default mainRouter;
