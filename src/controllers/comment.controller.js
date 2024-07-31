import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asynchandler} from "../utils/asynchandler.js"

const getVideoComments = asynchandler(async (req, res) => {
    // TODO: get all comments for a video
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    try {
        if (!isValidObjectId(videoId)) {
            throw new ApiError(401, "Not a valid object id");
        }

        const video = await Video.findById(videoId);
        if (!video) {
            throw new ApiError(401, "Video not found");
        }

        const aggregateQuery = Comment.aggregate([
            {
                $match: { video: new mongoose.Types.ObjectId(videoId) }
            },
            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "comment",
                    as: "likes"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "ownerDetails"
                }
            },
            {
                $addFields: {
                    likecount: { $size: "$likes" },
                    owner: { $arrayElemAt: ["$ownerDetails", 0] },
                    isLiked: {
                        $cond: {
                            if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$likes.likedBy"] },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $project: {
                    content: 1,
                    createdAt: 1,
                    likecount: 1,
                    owner: {
                        username: 1,
                        fullName: 1,
                        avatar: 1,
                        _id:1
                    },
                    isLiked: 1
                }
            }
        ]);

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10)
        };

        const paginatedComments = await Comment.aggregatePaginate(aggregateQuery, options);
        // console.log(paginatedComments)
        if (!paginatedComments) {
            throw new ApiError(402, "Failed to paginate");
        }

        return res.status(200).json(new ApiResponse(200, paginatedComments, "Comments fetched"));
    } catch (error) {
        return res.status(500).json(new ApiError(500, "Can't fetch the comments"));
    }
});


const addComment = asynchandler(async (req, res) => {
    // TODO: add a comment to a video
    const {videoId} = req.params;
   const {content} = req.body;
   if(!videoId){
    throw new ApiError(500,"incorrect video id");
   }
   console.log(content);
   if(!content){
    throw new ApiError(500,"no content found")
   }
   const addComment=await Comment.create(
    {
        content:content,
        video:videoId,
        owner:req.user?._id
    }
   )
   if(!addComment){
     throw new ApiError(500,"failed to add comment please try again")
   }
   return res.status(200).json(new ApiResponse(200,addComment,"comment successfully added"))
})

const updateComment = asynchandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;
  
    if (!isValidObjectId(commentId)) {
      throw new ApiError(400, "Invalid comment ID");
    }
  
    if (!content) {
      throw new ApiError(400, "Content can't be empty");
    }
  
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }
  
    if (comment.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You are not authorized to update this comment");
    }
  
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { $set: { content } },
      { new: true }
    );
  
    if (!updatedComment) {
      throw new ApiError(500, "Comment could not be updated");
    }
  
    return res.status(200).json({
      status: 200,
      data: updatedComment,
      message: "Comment successfully updated"
    });
  });
  

const deleteComment = asynchandler(async (req, res) => {
    // TODO: delete a comment
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }