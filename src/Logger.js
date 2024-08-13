import fs from "fs";

const writeLog = (level, message) => {
    const timestamp = new Date().toISOString(); // Corrected variable name
    const logEntry = `${timestamp} - ${level.toUpperCase()} : ${message} \n`;
    const logFile = `logs/${level}.txt`;

    if (!fs.existsSync('logs')) {
        fs.mkdirSync('logs');
    }

    fs.appendFile(logFile, logEntry, (err) => {
        if (err) {
            console.log(`Failed to write ${level} log:`, err);
        }
    });
}

export default writeLog;
