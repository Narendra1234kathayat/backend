import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentuser,
  getUserChannelProfile,
  getWatchHistory,
  loginInUser,
  logoutUser,
  RefreshAccessToken,
  registerUser,
  updateuserAvatar,
  updateuserCoverimg,
  uppdateAccountDetails,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router({});
router.route("/register").post( upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImg",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginInUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(RefreshAccessToken);
router.route("/changepassword").post(verifyJWT, changeCurrentPassword);
router.route("/currentuser").get(verifyJWT, getCurrentuser);
router.route("/update-account").patch(verifyJWT,uppdateAccountDetails);
router
  .route("/update-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateuserAvatar);
router
  .route("/cover-Image")
  .patch(verifyJWT, upload.single("coverImg"), updateuserCoverimg);
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
router.route("/watch-history").get(verifyJWT, getWatchHistory);
export default router;
