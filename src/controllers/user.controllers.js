import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import jwt from 'jsonwebtoken'

    //method to gererate accesss and refresh token
    const generateAccessAndRefreshToken = async(userId)=>{

        try{
            const user = User.findById(userId)
            if(!user){
                console.log("User not exists")
            }

            const accessToken = user.generateAccessToken()
            const refreshToken = user.generateRefreshToken()

            user.refreshToken = refreshToken
            await user.save({validatBeforeSave:false})
            return {accessToken,refreshToken}
        }catch(error){
            throw new ApiError(500,"Something went wrong while generating access and refresh tokne")
        }
    }

    //genrating new accessToken with the help of refreshToken
    const refreshAccessToken = asyncHandler(async(req,res)=>{
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken){
            throw new ApiError(401,"Refresh token is required")
        }

        //validating incoming refresh Token with the refresh token that is stored in the database
        try{
            const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET) 
            const user = await User.findById(decodedToken?._id)

            if(!user){
                throw new ApiError(401,"Invalid Refresh Token")
            }

            if(incomingRefreshToken !== user?.refreshToken){
                throw new ApiError(401,"Invalid Refresh Token")
            }
            
            const options = {
                httpOnly : true,
                secure: process_params.env.NODE_ENV === "production"
            }

            const {accessToken,refreshToken:newRefreshTokne} = await generateAccessAndRefreshToken(user._id)

            return res
            .staus(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",newRefreshTokne,options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken,refreshToken:newRefreshTokne},
                    "Access token refreshed successfully"
                )
            )
            
        }catch(error){
            throw new ApiError(501,"Something went wrong while refreshing access token")
        }
    })

    // Registering the new user
    const registerUser = asyncHandler(async(req,res)=>{
        const {fullname,email,username,password} = req.body

        //validation of tha all fields ar required
        if(
            [fullname,username,email,password].some(field=>
                field?.trim() === "")
        ){
            throw new ApiError(400,"All filds are required")
        }

        //checking if there any already user exists with the same data
        const existedUser = await User.findOne({
            $or:[{username},{email}]
        })

        //if already user exist , throw the below error
        if(existedUser){
            throw new ApiError(409,"User with email or username already exist")
        }

        //we have reached here only when we have confirmed no such user exists
        //console.warn("This is the information in req.files: ", req.files)
        const avatarLocalPath = req.files?.avatar?.[0]?.path 
        const coverLocalPath = req.files?.coverImage?.[0]?.path

        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is missing")
        }


        // const avatar = await uploadOnCloudinary(avatarLocalPath)
        // let coverImage = ""
        // if(coverLocalPath){
        //     coverImage = await uploadOnCloudinary(coverLocalPath)
        // }


        let avatar;
        try{
            avatar = await uploadOnCloudinary(avatarLocalPath)
            console.log("avatar upoladed successfully",avatar)
        }catch(error){
            console.log("Error uploading avatar : ",error)
            throw new ApiError(500,"An error was occured while uploading avatar")
        }

        let coverImage;
        try{
            coverImage = await uploadOnCloudinary(coverLocalPath)
            console.log("avatar upoladed successfully",coverImage)
        }catch(error){
            console.log("Error uploading coverImage : ",error)
            throw new ApiError(500,"An error was occured while uploading coverImage")
        }


        //creating new user in mongoDB
        try{
            const user = await User.create({
                fullname,
                avatar:avatar.url,
                coverImage:coverImage?.url || "",
                email,
                password,
                username:username.toLowerCase()
            })
    
            //checking if the new user has been created or not
            const createdUser = await User.findById(user._id).select(
                "-password -refreshToken" //deselectin password and refreshToken
            )
    
            if(!createdUser){
                throw new ApiError(500,"Something went wrong while registering the user")
            }
    
            return res
                .status(201)
                .json(new ApiResponse(200,createdUser,"User registered successfully"))
    
        }
        catch(error){
            console.log("User creation failed")

            if(avatar){
                await deleteFromCloudinary(avatar.public_id)
            }

            if(coverImage){
                await deleteFromCloudinary(coverImage.public_id)
            }

            throw new ApiError(500,"Something went wrong while registering the user and images were delted")

        }



    })

    
    //login
    const loginUser = asyncHandler(async(req,res)=>{
        const {email,username,password} = req.body

        //validation
        if(
            [email,username,password].some(field=>
                field?.trim() === "")
        ){
            throw new ApiError(400,"All filds are required")
        }

        const user = await User.findOne({
            $or:[{username},{email}]
        })

        if(!user){
            throw new ApiError(404,"User not found")
        }

        //validate Password
        const isPasswordValid  = await user.isPasswordCorrect(password)

        if(!isPasswordValid){
            throw new ApiError(401,"Invalid Credentials")
        }

        const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

        const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")

        const options = {
            httpOnly : true,
            secure: process_params.env.NODE_ENV === "production"
        }

        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(new ApiResponse(
            {user:loggedInUser,accessToken,refreshToken},
            "User logged in successfully"
        ))

    })

    const logoutUser = asyncHandler(async(req,res)=>{
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken:undefined  //it can be also set to null
                }
            },
            {new : true}//returns the updated user document after the update operation
        )

        const options = {
            httpOnly : true,
            secure: process.env.NODE_ENV === "production"
        }

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200, {}, "User logged out successfully"))

    })

    const changeCurrentPassword = asyncHandler(async(req,res)=>{
        const {oldPassword,newPassword} = req.body

        const user = await User.findById(req.user?._id)

        const isPasswordValid = await user.isPasswordCorrect(oldPassword)

        if(!isPasswordValid){
            throw new ApiError(401,"Invalid Password")
        }

        user.password = newPassword
        await user.save({validatBeforeSave:false})

        return res
        .status(200)
        .json(new ApiResponse(200,{},"Password changed Successfully"))


    })

    const getCurrentUser = asyncHandler(async(req,res)=>{
        return res
        .status(200)
        .json(new ApiResponse(200,req.user,"current user fetched successfully"))
    })

    const updateAccountDetails = asyncHandler(async(req,res)=>{
        const {fullname,email} = req.body

        if(!fullname || !email){
            throw new ApiError(400,"fullname and email are required")
        }

        //check if email is already in use
        const existingUser = await User.findOne({email})
        if(existingUser && existingUser._id.toString() != req.user._id.toString()){
            throw new ApiError(400,"Email already exists")
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    fullname,
                    email
                }
            },
            {new : true}
        ).select("-password -refreshToken")


        return res
        .status(200)
        .json(new ApiResponse(200,user,"Accound Details updated successfully"))
    })

    const updateUserAvatar = asyncHandler(async(req,res)=>{
        const avatarLocalPath = req.file?.path

        if(!avatarLocalPath){
            throw new ApiError(400,"File is required")
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)
        
        if(!avatar.url){
            throw new ApiError(500,"Something went wrong while uplaoding avatar")
        }

        const user = User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    avatar:avatar.url
                }
            },
            {new:true}
        ).select("-password -refreshToken")

        return res
        .status(200)
        .json(new ApiResponse(200,user,"Avatar updated successfully"))

    })

    const updateUsercoverImage = asyncHandler(async(req,res)=>{
        const coverLocalPath = req.file?.path

        if(!coverLocalPath){
            throw new ApiError(400,"File is required")
        }

        const coverImage = await uploadOnCloudinary(coverLocalPath)

        if(!coverImage.url){
            throw new ApiError(500,"Something went wrong while updating cover image")
        }

        const user = User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    coverImage : coverImage.url
                }
            },
            {new:true}
        ).select("-password -refreshToken")

        return res
        .status(200)
        .json(new ApiResponse(200,user,"Cover image updated successfully"))

    })


    const getUserChannelProfile = asyncHandler(async(req, res) => {
        const {username} = req.params
    
        if (!username?.trim()) {
            throw new ApiError(400, "username is missing")
        }
    
        const channel = await User.aggregate([
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    channelsSubscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    channelsSubscribedToCount: 1,
                    isSubscribed: 1,
                    avatar: 1,
                    coverImage: 1,
                    email: 1
    
                }
            }
        ])
    
        if (!channel?.length) {
            throw new ApiError(404, "channel does not exists")
        }
    
        return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched successfully")
        )
    })
    
    const getWatchHistory = asyncHandler(async(req, res) => {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "watchHistory",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "owner",
                                pipeline: [
                                    {
                                        $project: {
                                            fullName: 1,
                                            username: 1,
                                            avatar: 1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields:{
                                owner:{
                                    $first: "$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ])
    
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully"
            )
        )
    })
    

export{
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUsercoverImage,
    getUserChannelProfile,
    getWatchHistory
    
}

