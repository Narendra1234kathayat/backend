import mongoose,{isValidObjectId} from "mongoose";
import { asynchandler } from "../utils/asynchandler.js";
// import { aggregatePaginate } from "mongoose-aggregate-paginate-v2";
import {Like} from "../models/like.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";


const toggleVideoLike = asynchandler(async (req,res)=>{
    const {videoId} = req.params;
    if(!isValidObjectId(videoId)){
        throw new ApiError(401,"not valid objectid");
    }
    const alreadyliked=await Like.findOne({
        Video:videoId,
        likedBy:req.user?._id
    })
    console.log(alreadyliked)
    if(alreadyliked){
        await Like.findByIdAndDelete(alreadyliked?._id);
        return res.status(200).json(new ApiResponse(200,{isliked:false},"toogled like"))
    }
    await Like.create({
        Video:videoId,
        likedBy:req.user?._id
    })
    return res.status(200).json(new ApiResponse(200,{isliked:true}));

    



});

const toggleCommentLike = asynchandler(async (req, res) => {
    const {commentId} = req.params;
    //TODO: toggle like on comment
    if(isValidObjectId(commentId)){
        throw new ApiError(401,"not a valid id");

    }
    const alreadyliked=await Like.findOne({
        comment:commentId,
        likedBy:req?.user?._id

    })
    if(alreadyliked){
        await like.findByIdAndDelete(alreadyliked?._id);
        return res.status(200).json(new ApiResponse(200,{isliked:false}))
    }
    await like.create({
        comment:commentId,
        likedBy:req?.user?._id
    })
    return res.status(200).json(new ApiResponse(200,{isliked:true}));

})

const toggleTweetLike = asynchandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if(isValidObjectId(tweetId)){
        throw new ApiError(401,"not a valid Id")
    }
    const alreadyliked=await like.findOne
    ({
        tweet:tweetId,
        likedBy:req?.user?._id
    })
    if(alreadyliked) {
        await like.findByIdAndDelete(alreadyliked._id);
        return res.status(200).json(new ApiResponse(200,{isliked:false}));
    }
    await Like.create({
        tweet:tweetId,
        likedBy:req?.user?._id
    })
    return res.status(200).json(new ApiResponse(200,{isliked:true}));
}
)

const getLikedVideos = asynchandler(async (req, res) => {

    // const user=await User.findById(req.user?._id);
    // console.log(user);
    //TODO: get all liked videos
    const likedVideos = await Like.aggregate([
        {
            $match: { likedBy: new mongoose.Types.ObjectId(req.user?._id) }
        },
        {
            $lookup: {
                from: "videos",
                localField: "Video", // Ensure this matches the field in the Like model
                foreignField: "_id",
                as: "likedvideo",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerdetails"
                        }
                    },
                    {
                        $unwind: "$ownerdetails"
                    }
                ]
            }
        },
        {
            $unwind: "$likedvideo"
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                _id: 1,
                likedVideo: {
                    _id: "$likedvideo._id",
                    videoFile: "$likedvideo.videoFile",
                    thumbnail: "$likedvideo.thumbnail",
                    owner: "$likedvideo.owner",
                    title: "$likedvideo.title",
                    description: "$likedvideo.description",
                    views: "$likedvideo.views",
                    duration: "$likedvideo.duration",
                    createdAt: "$likedvideo.createdAt",
                    isPublished: "$likedvideo.isPublished",
                    ownerDetails: {
                        username: "$likedvideo.ownerdetails.username",
                        fullName: "$likedvideo.ownerdetails.fullName",
                        avatar: "$likedvideo.ownerdetails.avatar"
                    }
                }
            }
        }
    ]);
    
    console.log(likedVideos); 
    return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    likedVideos,
                    "All Video fetched"
                )
            )

})


export { toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos};
