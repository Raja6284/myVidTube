import jwt from 'jsonwebtoken'
import { User } from '../models/user.models.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'


export const verifyJWT = asyncHandler(async(req,_,next)=>{
    //  Extract the access token from cookies or authorization header
    const token = req.cookies.accessToken || req.header("Authorization")?.replace("Bearer ","")

    if(!token){
        throw new ApiError(401,"Unauthorized")
    }

    try{
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

        const user = User.findById(decodedToken?._id).select
        ("-password -refreshToken")

        if(!user){
            throw new ApiError(401,"Unauthorized")
        }
        // Attach the user to the request object for use in further middleware or route handler
        req.user = user
        //call the next middleware or router handler
        next()
    }catch(error){
        throw new ApiError(401,error?.message || "Invalid Access Token")
    }
})