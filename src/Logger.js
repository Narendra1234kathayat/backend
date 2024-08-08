import fs from "fs"

const writeLog=(level,message)=>{
    const timestay=new Date().toISOString()
    const logEntry=`${timestay}- ${level.toUpperCase()} : ${message} \n`;
    const logFile= `logs/${level}.txt`;

    if(!fs.existsSync('logs')){
        fs.mkdirSync('logs');

    }
    fs.appendFile(logFile,logEntry,(err)=>{
        if(err){
            console.log(`failed to write ${level} log:`,err);
        }
    })
}
export default writeLog;