import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asynchandler } from "../utils/asynchandler.js";
import writeLog from "../Logger.js";
import { Logger } from "../utils/Loggers.js";

// Get all videos
const getAllVideos = asynchandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const logger = new Logger(req.cookies.accesstoken);
  logger.info("info",`getting the Videos ${req.method} ${req.baseUrl}`)
  writeLog("info", `Get all videos request received. Method: ${req.method}, URL: ${req.baseUrl}, User: ${req.user.username.toUpperCase()}`);

  page = parseInt(page);
  limit = parseInt(limit);

  const filters = {};

  if (query) {
    filters.title = { $regex: query, $options: "i" };
  }

  if (userId) {
    filters.owner = new mongoose.Types.ObjectId(userId);
  }

  let sortCriteria = {};
  if (sortBy) {
    sortCriteria[sortBy] = sortType === "descending" ? -1 : 1;
  } else {
    sortCriteria.createdAt = 1;
  }

  try {
    const videos = await Video.aggregate([
      { $match: filters },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          videoFile: 1,
          thumbnail: 1,
          title: 1,
          description: 1,
          owner: 1,
          duration: 1,
          views: 1,
          useravatar: "$userDetails.avatar",
          username: "$userDetails.username",
        },
      },
      { $sort: sortCriteria },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]);

    if (!videos.length) {
      writeLog("warn",` No videos found with this ${query} `);
      return res.status(404).json(new ApiError(400, "No videos found"));
    }

    writeLog("info", "Videos fetched successfully");
    return res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"));
  } catch (err) {
    writeLog("error", `Error fetching videos: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

// Publish a video
const publishAVideo = asynchandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field?.trim() === "")) {
    writeLog("warn", "Title or description is missing");
    throw new ApiError(401, "Title is Required");
  }

  const videoFileLocal = req.files?.videoFile[0]?.filename;
  const thumbnailLocal = req.files?.thumbnail[0]?.filename;

  if (!videoFileLocal) {
    writeLog("warn", "Video file is missing");
    throw new ApiError(401, "Video File is missing");
  }

  if (!thumbnailLocal) {
    writeLog("warn", "Thumbnail is missing");
    throw new ApiError(401, "Thumbnail is missing");
  }

  try {
    const video = await Video.create({
      title,
      description,
      duration: 20,
      videoFile: videoFileLocal,
      thumbnail: thumbnailLocal,
      owner: req.user?._id,
      isPublished: true,
    });

    writeLog("info", `Video published successfully. Video ID: ${video._id}`);
    return res.status(200).json(new ApiResponse(200, video, "Video Published Successfully"));
  } catch (err) {
    writeLog("error", `Error publishing video: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

// Get video by ID
const getVideoById = asynchandler(async (req, res) => {
  const { videoId } = req.params;
  writeLog("info", `Get video by ID request received. Method: ${req.method}, url: ${req.baseUrl}, User: ${req.user.username.toUpperCase()}`);

  if (!isValidObjectId(videoId)) {
    writeLog("warn", `${videoId} Invalid video ID`);
    throw new ApiError(500, "Incorrect video ID");
  }

  const userId = req.user?._id;
  if (!userId) {
    writeLog("warn", "User not authenticated");
    throw new ApiError(401, "User not authenticated");
  }

  try {
    const video = await Video.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(videoId) } },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "Video",
          as: "likes",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
              },
            },
            {
              $addFields: {
                subscribersCount: { $size: "$subscribers" },
                isSubscribed: {
                  $cond: {
                    if: { $in: [new mongoose.Types.ObjectId(userId), "$subscribers.subscriber"] },
                    then: true,
                    else: false,
                  },
                },
              },
            },
            { $project: { username: 1, avatar: 1, subscribersCount: 1, isSubscribed: 1 } },
          ],
        },
      },
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          owner: { $arrayElemAt: ["$owner", 0] },
          isLiked: {
            $cond: {
              if: { $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          videoFile: 1,
          title: 1,
          description: 1,
          views: 1,
          createdAt: 1,
          duration: 1,
          comments: 1,
          owner: 1,
          likeCount: 1,
          isLiked: 1,
          isSubscribed: 1,
        },
      },
    ]);

    if (!video || video.length === 0) {
      writeLog("warn",`${video.title}  Video not found`);
      throw new ApiError(400, "Video does not exist");
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    await User.findByIdAndUpdate(userId, { $addToSet: { watchhistory: videoId } });

    writeLog("info", `Video fetched successfully. Video ID: ${videoId}`);
    return res.status(200).json(new ApiResponse(200, video[0], "Video fetched"));
  } catch (err) {
    writeLog("error", `Error fetching video: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

// Update a video
const updateVideo = asynchandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    writeLog("warn", "Invalid video ID");
    throw new ApiError(400, "Id is not valid");
  }

  if ([title, description].some((field) => field?.trim() === "")) {
    writeLog("warn", "Title or description fields are empty");
    throw new ApiError(500, "Fields are empty");
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      writeLog("warn",` Video not found`);
      throw new ApiError(500, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      writeLog("warn", "User not authorized to update this video");
      throw new ApiError(401, "You can't edit as you are not the owner of this video");
    }

    const thumbnailFilename = req.file?.filename;
    const videosupload = await Video.findByIdAndUpdate(
      videoId,
      {
        $set: {
          title,
          description,
          thumbnail: thumbnailFilename,
        },
      },
      { new: true }
    );

    if (!videosupload) {
      writeLog("warn", "Video update failed");
      throw new ApiError(401, "File do not uploaded");
    }

    writeLog("info", `Video updated successfully. Video ID: ${videoId}`);
    return res.status(200).json(new ApiResponse(200, videosupload, "Successfully updated video"));
  } catch (err) {
    writeLog("error", `Error updating video: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

// Delete a video
const deleteVideo = asynchandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    writeLog("warn", "Invalid video ID");
    throw new ApiError(400, "Invalid video ID");
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      writeLog("warn", "Video not found");
      throw new ApiError(404, "Video not found");
    }

    if (video.owner?.toString() !== req.user._id.toString()) {
      writeLog("warn", "User not authorized to delete this video");
      throw new ApiError(403, "You are not the owner of the video");
    }

    const deletedvideo = await Video.findByIdAndDelete(video._id);

    writeLog("info", `Video deleted successfully. Video ID: ${videoId}`);
    return res.status(200).json(new ApiResponse(200, deletedvideo, "Successfully deleted the video."));
  } catch (err) {
    writeLog("error", `Error deleting video: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

// Toggle video publish status
const togglePublishStatus = asynchandler(async (req, res) => {
  const { videoId } = req.params;
  writeLog("info",`public status ${req.baseUrl}`);

  if (!isValidObjectId(videoId)) {
    writeLog("warn", "Invalid video ID");
    throw new ApiError(400, "Invalid object ID");
  }

  try {
    const video = await Video.findById(videoId);
    if (!video) {
      writeLog("warn", "Video not found");
      throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
      writeLog("warn", "User not authorized to toggle publish status");
      throw new ApiError(403, "You are not the owner and cannot change the video data");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        $set: {
          isPublished: !video.isPublished,
        },
      },
      { new: true }
    );

    if (!updatedVideo) {
      writeLog("warn", "Failed to update video status");
      throw new ApiError(500, "Unable to change the status");
    }

    writeLog("info", `Video publish status toggled successfully. Video ID: ${videoId}`);
    return res.status(200).json(new ApiResponse(200, { isPublished: updatedVideo.isPublished }, "Status updated successfully"));
  } catch (err) {
    writeLog("error", `Error toggling video publish status: ${err.message}`);
    res.status(500).json(new ApiError(500, err.message));
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
