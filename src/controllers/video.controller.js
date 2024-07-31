import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynchandler} from "../utils/asynchandler.js"
// import fs from"fs";

const getAllVideos = asynchandler(async (req, res) => {
    let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

    // Convert page and limit to integers
    page = parseInt(page);
    limit = parseInt(limit);

    // Constructing the base query
    const filters = {};

    if (query) {
        filters.title = { $regex: query, $options: 'i' }; // Case-insensitive regex search
    }
   

    if (userId) {
        filters.owner = new mongoose.Types.ObjectId(userId); // Assuming owner refers to userId
    }

    // Sorting
    let sortCriteria = {};
    if (sortBy) {
        sortCriteria[sortBy] = sortType === 'descending' ? -1 : 1;
    } else {
        // Default sorting if not specified
        sortCriteria.createdAt = 1; // Example: sorting by createdAt ascending
    }

    try {
        const videos = await Video.aggregate([
            {
                $match: filters
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $unwind: {
                    path: "$userDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
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
                    username: "$userDetails.username"
                }
            },
            {
                $sort: sortCriteria
            },
            {
                $skip: (page - 1) * limit
            },
            {
                $limit: limit
            }
        ]);

        if (!videos.length) {
            throw new ApiError(400, "No videos found");
        }

        return res.status(200).json(new ApiResponse(200, videos, "Videos fetched successfully"));
    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json(new ApiError(500, err.message));
    }
});

const publishAVideo = asynchandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
  
    
    if([title, description].some((field) => field?.trim() === "")){
        throw new ApiError(401,"Title is Required")

    }
    console.log(req.files?.videoFile[0].filename);

    const videoFileLocal = req.files?.videoFile[0]?.filename;
    const thumbnailLocal = req.files?.thumbnail[0]?.filename;
    // console.log(videoFileLocal,thumbnailLocal)
    if(!videoFileLocal) {
        throw new ApiError(401,"Video File is missing")
    }

    if(!thumbnailLocal) {
        throw new ApiError(401,"Thumbnail is missing")
    }
   


  
    const video = await Video.create({
        title,
        description,
        duration:20,
        videoFile:videoFileLocal,
        thumbnail:thumbnailLocal,
        owner:req.user?._id,
        isPublished:true
    })

    const videoUploaded = await Video.findById(video?._id)

    if(!videoUploaded){
        throw new ApiError(400,"Video failed to upload")
    }
    

    return res
    .status(200)
    .json(
        new ApiResponse(200,video,"Video Published Successfully")
    )


    
});

const getVideoById = asynchandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(500, "Incorrect video ID");
    }

    const userId = req.user?._id;
    if (!userId) {
        throw new ApiError(401, "User not authenticated");
    }

    const video = await Video.aggregate([
        { 
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            } 
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "Video",
                as: "likes"
            }
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
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$subscribers" },
                            isSubscribed: {
                                $cond: {
                                    if: { $in: [new mongoose.Types.ObjectId(userId), "$subscribers.subscriber"] },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likeCount: { $size: "$likes" },
                owner: { $arrayElemAt: ["$owner", 0] },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
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
                isSubscribed: 1
            }
        }
    ]);

    if (!video || video.length === 0) {
        throw new ApiError(400, "Video does not exist");
    }

    // Increment views
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    // Add this video to user watch history
    await User.findByIdAndUpdate(userId, {
        $addToSet: {
            watchhistory: videoId
        }
    });

    return res.status(200).json(new ApiResponse(200, video[0], "Video fetched"));
});


const updateVideo = asynchandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    
    // Check if videoId is valid
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Id is not valid");
    }

    // Validate fields
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(500, "Fields are empty");
    }

    // Find the video
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(500, "Video not found");
    }

    // Check if the requester is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(401, "You can't edit as you are not the owner of this video");
    }

    // Handle the thumbnail file if provided
    const thumbnailFilename = req.file?.filename;
    const videosupload=await Video.findByIdAndUpdate(videoId,{
        $set:{
            title,
            description,
            thumbnailFilename,

        }

    },
    {
        new:true
    }
)
   if(!videosupload){
    throw new ApiError(401,"file do not uploaded")

   }

    // Save the updated video
    await video.save();

    // Respond to the client
   return  res.status(200).json(
       new ApiResponse(200,videosupload,"successfully uploaded video")
    );
});


const deleteVideo = asynchandler(async (req, res) => {
    const { videoId } = req.params;

    // Check if videoId is valid
    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find the video
    const video = await Video.findById(videoId);
    console.log(video, "ehfdsf");
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the requester is the owner of the video
    if (video.owner?.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not the owner of the video");
    }

    // Delete the video
   const deletedvideo= await Video.findByIdAndDelete(video._id);
    // Respond to the client
    return res.status(200).json(new ApiResponse(200, deletedvideo, "Successfully deleted the video."));
});

const togglePublishStatus = asynchandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid object ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not the owner and cannot change the video data");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(500, "Unable to change the status");
    }

    return res.status(200).json(new ApiResponse(200, { isPublished: updatedVideo.isPublished }, "Status updated successfully"));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}