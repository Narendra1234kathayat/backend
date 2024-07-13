import mongoose, { isValidObjectId } from "mongoose";

import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asynchandler } from "../utils/asynchandler.js";

const toggleSubscription = asynchandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "not valid channelId");
  }
  const subs = await Subscription.findOne({
    subscriber: req.user?._id,
    channel: channelId,
  });
  console.log(subs);
  if (subs) {
    await Subscription.findByIdAndDelete(subs?._id);
    return res
      .status(200)
      .json(new ApiResponse(200, { subscribed: false }, "successful"));
  }
  await Subscription.create({
    subscriber: req.user?._id,
    channel: channelId,
  });

  return res.status(200).json(new ApiResponse(200, { subscribed: true }, "successful"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asynchandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(401, "incorrect channel Id");
  }
  const subs = await Subscription.aggregate([
    {
        $match: {
            channel: new mongoose.Types.ObjectId(channelId),
        },
    },
    {
        $lookup: {
            from: "users",
            localField: "subscriber",
            foreignField: "_id",
            as: "subscriber",
            pipeline: [
                {
                    $lookup: {
                        from: "subscriptions",
                        localField: "_id",
                        foreignField: "channel",
                        as: "issubscribed",
                    },
                },
                {
                    $addFields: {
                        subscribedtosubscriber: {
                            $cond: {
                                if: {
                                    $in: [new mongoose.Types.ObjectId(channelId), "$issubscribed.subscribers"],
                                },
                                then: true,
                                else: false,
                            },
                        },
                        subscribercount: {
                            $size: "$issubscribed",
                        },
                    },
                },
            ],
        },
    },
    {
        $unwind: "$subscriber",
    },
    {
        $project: {
            _id: 1,
            subscriber: {
                _id: 1,
                username: 1,
                fullname: 1,
                avatar: 1,
                issubscribed: 1,
                subscribedtosubscriber: 1,
                subscribercount:1
            },
        },
    },
]);


  if(!subs){
    throw new ApiError(501, "Failed to fetch");
}

return res.status(200).json(new ApiResponse(200,subs,"Fetched"))
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asynchandler(async (req, res) => {
  const { subscriberId } = req.params;
  if(!isValidObjectId(subscriberId)){
    throw new ApiResponse(401,"not a valid id");
  }
  const subscribedchannel = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId)
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "subscribedchannel",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos"
            }
          },
          {
            $addFields: {
              latestVideo: { $arrayElemAt: ["$videos", -1] }
            }
          }
        ]
      }
    },
    {
      $unwind: "$subscribedchannel"
    },
    {
      $project: {
        _id: 1,
        subscribedchannel: {
          _id: 1,
          username: 1,
          avatar: 1,
          latestVideo: {
            _id: 1,
            videoFile: 1,
            thumbnail: 1,
            owner: 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            createdAt: 1
          }
        }
      }
    }
  ]);
  
  console.log(subscribedchannel);
  return res.status(200).json(new ApiResponse(200,subscribedchannel,"successfully subscribed channel"))

});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
