import mongoose, { isValidObjectId } from "mongoose";
import { asynchandler } from "../utils/asynchandler.js";
import { Log } from "../models/log.model.js";

const getLog = asynchandler(async (req, res) => {
    const id = req.user?._id;
    
    if (!isValidObjectId(id)) {
        return res.status(401).json({ error: "Invalid ObjectId" });
    }

    try {
        const logs = await Log.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(id),
                }
            },
            {
                $project: {
                    logType: 1,
                    message: 1,
                    timestamp: 1
                }
            }
        ]);

        if (logs.length === 0) {
            return res.status(404).json({ error: "Logs not found" });
        }

        return res.status(200).json({ logs });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

export { getLog };
