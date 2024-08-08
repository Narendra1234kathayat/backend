import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import writeLog from "../writeLog.js"


const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accesstoken = user.generateRefreshToken();
    const refreshtoken = user.generateRefreshToken();

    user.refreshToken = refreshtoken;
    await user.save({ validateBeforeSave: false });

    return { accesstoken, refreshtoken };
  } catch (error) {
   return res.status(500).json( ApiError(
      500,
      "something went wrong while generating access and refresh token"
    ))
  }
};

const registerUser = asynchandler(async (req, res) => {
  const { username, email, password, fullname } = req.body;
  // console.log(req.body.data);
  // Check if any required fields are empty or undefined
  if (![username, email, password, fullname].every((field) => field)) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if username or email already exists
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new ApiError(400, "Username or email already exists");
  }
  console.log("images are", req.files.avatar);
  // Check if avatar and cover image paths are provided
  console.log(req.files?.avatar?.[0]);
  const avatarLocalPath = req.files?.avatar?.[0]?.filename;
  console.log(avatarLocalPath);
  //   const coverImgLocalPath = req.files?.coverImg?.[0]?.path;
  let coverImgLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImg) &&
    req.files.coverImg.length > 0
  ) {
    coverImgLocalPath = req.files.coverImg[0].filename;
  }
  // console.log(avatarLocalPath, coverImgLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Please upload the avatar image");
  }

  // Create new user
  const newUser = await User.create({
    username,
    email,
    password,
    fullname,
    avatar: avatarLocalPath,
    coverImg: coverImgLocalPath || " ", // Use a default value if coverImgLocalPath is falsy
  });

  // Find the created user excluding sensitive fields
  const createdUser = await User.findById(newUser._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(
      500,
      "Failed to retrieve user details after registration"
    );
  }

  // Respond with success message and created user details
  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginInUser = asynchandler(async (req, res) => {
  const { username, password, email } = req.body;
  writeLog("info", `recieved login info",${req.method} ${req.url}`)
  if (!username && !email) {
    throw new ApiError(
      400,
      "INPUT credential missing: username and email required"
    );
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect");
  }

  const { accesstoken, refreshtoken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user.id).select(
    "-password -refreshToken"
  );

  const options = {

    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
   // sameSite: "", // Helps mitigate CSRF attacks
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    
  };

  return res
    .status(200)
    .cookie("accesstoken", accesstoken)
    .cookie("refreshtoken", refreshtoken)
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
  res
    .status(200)
    .clearCookie("accesstoken", options)
    .clearCookie("refreshtoken", options)
    .json(new ApiResponse(200, {}, "user logged out "));
});
const RefreshAccessToken = asynchandler(async (req, res) => {
  try {
    const incommingrefreshtoken =
      req.cookies.refreshToken || req.body.refreshToken;
    if (!incommingrefreshtoken) {
      throw new ApiError(401, "unauthorized  request");
    }
    const decodedtoken = jwt.verify(
      incommingrefreshtoken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = User.findById(decodedtoken._id);
    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }
    if (incommingrefreshtoken !== user.refreshToken) {
      throw new ApiError(401, "refresh token is expired  or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accesstoken, newrefreshtoken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accesstoken", accesstoken, options)
      .cookie("refreshtoken", newrefreshtoken, options)
      .json(
        new ApiResponse(
          200,
          { accesstoken, refreshToken: newrefreshtoken },
          "access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message);
  }
});
const changeCurrentPassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = User.findById(req.user?._id);
  const ispasswordcorrect = user.isPasswordCorrect(oldPassword);
  if (!ispasswordcorrect) {
    throw new ApiError(400, "invalid old password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: true });
  return res.status(200).json(new ApiResponse(200,{}, "changed successfully"));
});
const getCurrentuser = asynchandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});
const uppdateAccountDetails = asynchandler(async (req, res) => {
  const { fullname, email } = req.body;

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
    // console.log(user);

    return res.status(200).json(new ApiResponse(200, user, "Account detail updated successfully"));
  } catch (error) {
    return res.status(error.statusCode || 500).json(new ApiResponse(error.message,"Internal Server Error"));
  }
});


const updateuserAvatar=asynchandler(async (req, res)=> {

  const avatarlocalpath=req.file?.filename;
  if(!avatarlocalpath){
    throw new ApiError(404,"avatar is missing");
  }
  const user=await User.findByIdAndUpdate(req.user?._id,{
    $set:{
      avatar:avatarlocalpath
    }
  },{
    new:true
  }).select("-password");
  return res.status(200).json(new ApiResponse(200,user,"coverimage uploaded successfully"));
    
})

const updateuserCoverimg=asynchandler(async (req, res)=>{
  const coverimglocalpath=req.file?.filename;
  // console.log(req.file?.filename)
  if(!coverimglocalpath){
    throw new ApiError(404,"coverimge file is missing");
  }
  // console.log(coverimglocalpath);
  const user=await User.findByIdAndUpdate(req.user?._id,{
    $set:{
      coverImg:coverimglocalpath
    }


  },{
    new:true
  }).select("-password");
    return res.status(200).json(new ApiResponse(200,user,"coverimage uploaded successfully"));
})

const getUserChannelProfile=asynchandler(async (req,res)=>{
  const {username}=req.params;
  // console.log(req.params);
  if(!username){
    throw new ApiError(400,"username is missing");
  }
  const channel=await User.aggregate([
    {
      $match:{
        username:username?.toLowerCase(),
      }
    },{
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"

      }
    },{
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"

      }
    }
    ,{
      $addFields:{
        subscriberCount:{
          $size:"$subscribers"
        }
        ,channelSubscriberTocount:{
          $size:"$subscribedTo"
        }
        ,
        isSubscribed:{
          $cond:{
            if:{$in:[req.user?._id ,"$subscribers.subscriber"]}
            ,then:true,
            else:false
          }
        }
      }
    },
    {
      $project:{
        fullname:1,
        username:1,
        subscriberCount:1,
        channelSubscriberTocount:1,
        isSubscribed:1,
        avatar:1,
        coverImg:1,
        email:1,
        
      }

    }
  ])
  
   if(!channel?.length){
    throw new ApiError(400,"channel dosent exixts");
   }
   return res.status(200).json(new ApiResponse(200,channel[0],"userchannel fetched successfully"));

})

const getWatchHistory = asynchandler(async (req, res) => {
  try {
    // console.log(req.user?._id);
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
    // console.log(user[0].watchhistory)

    return res.status(200).json(new ApiResponse(200, user[0].watchhistory, "Watched history fetched successfully"));
  } catch (error) {
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
  updateuserAvatar,updateuserCoverimg,
  getUserChannelProfile,
  getWatchHistory
};
