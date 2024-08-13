import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";
const logSchema = new Schema({
  logType: {
    type: String,
    required: true,
  }, // "info", "warn", or "error"
  message: {
    type: Object,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});
logSchema.plugin(mongooseAggregatePaginate);
export const Log = mongoose.model("Log", logSchema);
