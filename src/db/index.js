import mongoose from "mongoose";
import { Db_Name } from "../constants.js";




const connectDB=async()=>{
    try {
        console.log(Db_Name);
        const connectionUrl = process.env.MONGO_URL;
        const connectioninstance=await mongoose.connect(connectionUrl);
         console.log(`connection instance :: host is ${connectioninstance.connection.host}`);

        
    } catch (error) {
        console.log("error is ",error);
        process.exit(1);
        
    }
}
export default connectDB;