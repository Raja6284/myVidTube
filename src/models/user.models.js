/*
id string pk
username string
email string
fullName string
avatar string
coverImage string
watchHistory ObjectId[] videos
password string
refreshToken string
createdAt Date
updatedAt Date
*/


import mongoose ,{Schema} from "mongoose"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const UserSchema = new Schema(
    {
        username:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
            index:true
        },
        email:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true 
        },
        fullname:{
            type:String,
            required:true,
            index:true,
            lowercase:true,
            trim:true
        },
        avatar:{
            type:String,
            required:true,

        },
        coverimage:{
            type:String
        },
        watchhistory:[
            {
            type:Schema.Types.ObjectId,
            ref:"Video"
            }
        ],
        password:{
            type:String,
            required:[true,"Password is required"]
        },
        refreshToken:{
            type:String
        }
    },
    {timestamps:true}
)

//encrypting the password just before saving or updating it
UserSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next()

    this.password = await bcrypt.hash(this.password,10)
    next()
})

//comparing the entered passwrd and stored password in database in the the form of hash
UserSchema.methods.isPasswordCorrect = async function 
(passowrd) {
    return await bcrypt.compare(passowrd,this.passowrd)
}

//Refresh token
UserSchema.methods.generateAccessToken = function(){
    //short lived access token
    return jwt.sign({
        _id : this._id,
        email : this.email,
        username : this.username,
        fullname : this.fullname
    },
    process.env.ACCESS_TOKEN_SECRET,
    {expiresIn: process.env.ACCESS_TOKEN_EXPIRY}
)
}

//Refresh Token
UserSchema.methods.generateRefreshToken = function(){
    
    return jwt.sign({
        _id : this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {expiresIn: process.env.REFRESH_TOKEN_EXPIRY}
)
}

export const User = mongoose.model("User",UserSchema)