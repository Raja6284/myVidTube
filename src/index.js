import logger from "../logger.js";
import morgan from "morgan";
import express from "express";
import { app } from "./app.js";
import dotenv from "dotenv"
import connectDB from "./db/index.js";


dotenv.config({
    path:"./.env"
})


const PORT = process.env.PORT || 7000

connectDB()
.then(()=>{
    app.listen(PORT,()=>{
        console.log(`Server is running on port : ${PORT}`)
    })
})
.catch((err)=>{
    console.log("MongoDb connection error: ",err)
})




//logger.info(`The app is running on port ${PORT}`)


// const app = express()
const morganFormat = ":method :url :status :response-time ms";

app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

// logger.info("This is an information")
// logger.error("This is an error")
// logger.warn("This is a warning")
// logger.debug("This is a debug message")



// console.log("Hello from backend with Raja aka Berlin why this kolaveeri di")