import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, loginUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUsercoverImage } from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { logoutUser } from "../controllers/user.controllers.js";
import { getUserChannelProfile } from "../controllers/user.controllers.js";
import { getWatchHistory } from "../controllers/user.controllers.js";

const router = Router()

//unsecured routes
router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser)


    router.route("/login").post(loginUser)
    router.route("/refresh-token").post(refreshAccessToken)


    //secured routes
    router.route("/logout").post(verifyJWT,logoutUser)
    router.route("/change-password").post(verifyJWT,changeCurrentPassword)
    router.route("/current-user").get(verifyJWT,getCurrentUser)
    router.route("/update-account").patch(verifyJWT,updateAccountDetails)
    router.route("/update-avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
    router.route("/update-coverImage").patch(verifyJWT,upload.single("coverImage"),updateUsercoverImage)
    router.route("/c/:username").get(verifyJWT,getUserChannelProfile)
    router.route("/watch-history").get(verifyJWT,getWatchHistory)




export default router