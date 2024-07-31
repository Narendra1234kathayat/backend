import dotenv from "dotenv";
import connectDB from "./db/index.js";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
const port = 5050;
// import { fileURLToPath } from "url";
// import path from "path";

const corsOptions = {
  origin:  "http://localhost:5173", // Use environment variable for frontend URL
  credentials: true, // This allows cookies to be sent and received
};

app.use(cors(corsOptions));

app.use(express.static("./public/temp"));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

dotenv.config({
  path: "./.env",
});

//import userrouter
import userrouter from "./Routes/user.routes.js";
import videoRouter from "./Routes/video.routes.js";
import likeRouter from "./Routes/like.routes.js";
import subscriptionRouter from "./Routes/subscription.routes.js";
import commentRouter  from  "./Routes/comment.routes.js"

//router user
app.use("/api/v1/users", userrouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/likes",likeRouter);
app.use("/api/v1/comment", commentRouter);
app.use("/api/v1/subscriptions",subscriptionRouter);


connectDB()
  .then(() => {
    // app.on("err",(error)=>{
    //     console.log(error);
    //     throw error;
    // })

    app.listen(port, () => {
      console.log("server running at port number", port);
    });
  })
  .catch((err) => {
    console.log("mongo connection failure", err);
  });
