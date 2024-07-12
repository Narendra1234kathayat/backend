import {Router} from "express";
import {verifyJWT} from "../middlewares/auth.middleware.js"

import {  toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos } from "../controllers/like.controller.js";

const router = Router({});
router.use(verifyJWT);


router.route("/videos").get(getLikedVideos);
router.route("/:videoId").post(toggleVideoLike);
router.route("/comment/:commentId").post(toggleCommentLike);
router.route("/tweet/:tweetId").post(toggleTweetLike);




export default router;