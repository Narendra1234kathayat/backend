import mongoose, { Schema } from "mongoose";
import AggregatePaginate from "mongoose-aggregate-paginate-v2";

// Subscription Schema Definition
const subscriptionSchema = new Schema({
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: "User",
      
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: "User"
      
    }
  }, {
    timestamps: true
  });
  
  subscriptionSchema.plugin(AggregatePaginate);
  
  export const Subscription = mongoose.model("Subscription", subscriptionSchema);
  
