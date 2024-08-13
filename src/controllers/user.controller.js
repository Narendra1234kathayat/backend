import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import writeLog from "../Logger.js";
import { Logger } from "../utils/Loggers.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accesstoken = user.generateAccessToken();
    const refreshtoken = user.generateRefreshToken();

    user.refreshToken = refreshtoken;
    await user.save({ validateBeforeSave: false });

    return { accesstoken, refreshtoken };
  } catch (error) {
    writeLog("error", `Error generating tokens for user ${userId}: ${error.message}`);
    throw new ApiError(500, "Something went wrong while generating access and refresh token");
  }
};

const registerUser = asynchandler(async (req, res) => {
  const { username, email, password, fullname } = req.body;
  writeLog("info", `Register request received for username: method ${req.method} url ${req.url} ${username}`);

  if (![username, email, password, fullname].every((field) => field)) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    writeLog("warn", `Username or email already exists: ${username}, ${email}`);
    throw new ApiError(400, "Username or email already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.filename;
  let coverImgLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImg) &&
    req.files.coverImg.length > 0
  ) {
    coverImgLocalPath = req.files.coverImg[0].filename;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please upload the avatar image");
  }

  const newUser = await User.create({
    username,
    email,
    password,
    fullname,
    avatar: avatarLocalPath,
    coverImg: coverImgLocalPath || " ",
  });

  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    writeLog("error", `Failed to retrieve user details after registration for ${username}`);
    throw new ApiError(500, "Failed to retrieve user details after registration");
  }

  writeLog("info", `User registered successfully: ${username}`);
  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginInUser = asynchandler(async (req, res) => {
  const { username, password, email } = req.body;
  
  writeLog("info", `Login request received for username/email:${req.method} ${req.baseUrl} ${username || email}`);

  if (!username && !email) {
    throw new ApiError(400, "Input credential missing: username and email required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    writeLog("warn", `User not found: ${username || email}`);
    res.status(400).json( new ApiError(404, "User not found"));
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    writeLog("warn", `Invalid password for user: ${username || email}`);
    throw new ApiError(401, "Password is incorrect");
  }

  const { accesstoken, refreshtoken } = await generateAccessAndRefreshToken(user._id);

  const loggedInUser = await User.findById(user.id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  writeLog("info", `User logged in successfully: ${username || email}`);
  return res
    .status(200)
    .cookie("accesstoken", accesstoken, options)
    .cookie("refreshtoken", refreshtoken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accesstoken,
          refreshtoken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asynchandler(async (req, res) => {
  writeLog("info", `Logout request received for user ID: ${req.method} ${req.url} ${req.user._id}`);

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  writeLog("info", `User logged out successfully: ${req.user._id}`);
  res
    .status(200)
    .clearCookie("accesstoken", options)
    .clearCookie("refreshtoken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const RefreshAccessToken = asynchandler(async (req, res) => {
  try {
    writeLog("info", `Refresh token request received ${req.method} ${req.url}`);

    const incommingrefreshtoken =
      req.cookies.refreshToken || req.body.refreshToken;
    if (!incommingrefreshtoken) {
      throw new ApiError(401, "Unauthorized request");
    }
    const decodedtoken = jwt.verify(
      incommingrefreshtoken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedtoken._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incommingrefreshtoken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accesstoken, newrefreshtoken } =
      await generateAccessAndRefreshToken(user._id);

    writeLog("info", `Access token refreshed successfully for user: ${user._id}`);
    return res
      .status(200)
      .cookie("accesstoken", accesstoken, options)
      .cookie("refreshtoken", newrefreshtoken, options)
      .json(
        new ApiResponse(
          200,
          { accesstoken, refreshToken: newrefreshtoken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    writeLog("error", `Error refreshing access token: ${error.message}`);
    throw new ApiError(401, error?.message);
  }
});

const changeCurrentPassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  writeLog("info", `Change password request received for user: ${req.method} ${req.url} ${req.user?._id}`);

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: true });
  writeLog("info", `Password changed successfully for user: ${req.user._id}`);
  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentuser = asynchandler(async (req, res) => {
  writeLog("info", `Get current user request received ${req.method} ${req.url} ${req.user._id}`);
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const uppdateAccountDetails = asynchandler(async (req, res) => {
  const { fullname, email } = req.body;
  writeLog("info", `Update account details request received for user: ${req.user._id} ${req.method} ${req.url}`);

  if (!fullname || !email) {
    throw new ApiError(401, "Credentials are required");
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullname,
          email,
        },
      },
      { new: true }
    ).select("-password");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    writeLog("info", `Account details updated successfully for user: ${req.user._id}`);
    return res.status(200).json(new ApiResponse(200, user, "Account detail updated successfully"));
  } catch (error) {
    writeLog("error", `Error updating account details for user: ${req.user._id}: ${error.message}`);
    return res.status(error.statusCode || 500).json(new ApiResponse(500, "Internal Server Error"));
  }
});

const updateuserAvatar = asynchandler(async (req, res) => {
  const avatarLocalPath = req.file?.filename;
  writeLog("info", `Update avatar request received for user: ${req.user._id}`);

  if (!avatarLocalPath) {
    throw new ApiError(404, "Avatar is missing");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatarLocalPath,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  writeLog("info", `Avatar updated successfully for user: ${req.user._id}`);
  return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateuserCoverimg = asynchandler(async (req, res) => {
  const coverImgLocalPath = req.file?.filename;
  writeLog("info", `Update cover image request received for user: ${req.user._id}`);

  if (!coverImgLocalPath) {
    throw new ApiError(404, "Cover image file is missing");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImg: coverImgLocalPath,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  writeLog("info", `Cover image updated successfully for user: ${req.user._id}`);
  return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asynchandler(async (req, res) => {
  const { username } = req.params;
  writeLog("info", `Get user channel profile request received for username: ${req.method} ${req.url} ${username}`);

  if (!username) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscriberTocount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelSubscriberTocount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImg: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    writeLog("warn", `Channel does not exist for username: ${username}`);
    throw new ApiError(400, "Channel does not exist");
  }

  writeLog("info", `User channel profile fetched successfully for username: ${username}`);
  return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
});

const getWatchHistory = asynchandler(async (req, res) => {
  writeLog("info", `Get watch history request received for user: ${req.user.username.toUpperCase()} ${req.method} ${req.url} ${req.user._id}`);


  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user?._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchhistory",
          foreignField: "_id",
          as: "watchhistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullname: 1,
                      username: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
        },
      },
    ]);

    writeLog("info", `Watch history fetched successfully for user:${req.user.username.toUpperCase()} ${req.user._id}`);
    return res.status(200).json(new ApiResponse(200, user[0].watchhistory, "Watched history fetched successfully"));
  } catch (error) {
    writeLog("error", `Error fetching watch history for user: ${req.user._id}: ${error.message}`);
    return res.status(500).json(new ApiResponse(500, null, "Error fetching watched history"));
  }
});

export {
  registerUser,
  loginInUser,
  logoutUser,
  RefreshAccessToken,
  changeCurrentPassword,
  uppdateAccountDetails,
  getCurrentuser,
  updateuserAvatar,
  updateuserCoverimg,
  getUserChannelProfile,
  getWatchHistory,
};
