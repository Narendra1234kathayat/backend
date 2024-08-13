import Router from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getLog } from "../controllers/log.controller.js";

const router = Router({});

router.route("/getlog").get(verifyJWT,getLog);

export default router;
