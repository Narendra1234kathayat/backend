import { asynchandler } from "../utils/asynchandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

const verifyJWT=asynchandler(async(req,res,next)=>{
    try {
       
        
        const token= await req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ","");
     console.log(" cookies",req.cookies);
        if(!token){
            throw new ApiError(401,"unauthorized requestsss");
    
        }
        const decodedtoken=await jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);
    
       const user=await User.findById(decodedtoken?._id).select("-password -refreshToken");
        // console.log(user);
       if(!user){
        throw new ApiError(404,"Invalid access token");
       }
       req.user=user;
       next();
    } catch (error) {
        throw new ApiError(401,error?.message || "invalid access token");
        
    }

})

export {verifyJWT}