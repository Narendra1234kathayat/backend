import mongoose,{Schema} from "mongoose";
import AggregatePaginate from "mongoose-aggregate-paginate-v2";
const LikeSchema=new Schema({
    Video:{
        type:Schema.Types.ObjectId,
        ref:"Video"
    },
    comment:{
        type:Schema.Types.ObjectId,
        ref:"Comment"
    }
    ,tweet:{
        type:Schema.Types.ObjectId,
        ref:"Tweet"

    },
    likedBy:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    Owner:{
        type:Schema.Types.ObjectId,
        ref:"User"
    }
},{
    timestamps:true
})
LikeSchema.plugin(AggregatePaginate);
export const Like=mongoose.model("Like",LikeSchema);