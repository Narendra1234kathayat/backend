import { verifyJWT } from "../middlewares/auth.middleware.js";
import { Log } from "../models/log.model.js"; // Assuming Log is the mongoose model for logs

class Logger {
    constructor(token) {
        this.token = token;
    }

    // Private method to save log into MongoDB
    async saveLog(logType, message) {
        try {
            // Validate the token using verifyJWT
            const req = { cookies: { accesstoken: this.token }, header: () => `Bearer ${this.token}` };
            const res = {};
            await new Promise((resolve, reject) => {
                verifyJWT(req, res, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // If token is valid, save the log
            const log = new Log({
                logType,
                
                message,
                userId: req.user._id || null,
            });
            await log.save();
            console.log(`[${logType.toUpperCase()}] Log saved successfully.`);
        } catch (error) {
            console.error("Failed to save log:", error.message);
        }
    }

    // Method to log informational messages
    info(logType,  message) {
        this.saveLog(logType,  message);
    }

    // Method to log warnings
    warn(logType,  message) {
        this.saveLog(logType,  message);
    }

    // Method to log errors
    error(logType, message) {
        this.saveLog(logType,  message);
    }
}

export { Logger };
