import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import errorHandlerClass from "../utils/errorClass.js"
import userModel from "../models/userModel.js";
import getDataUri from "../utils/dataUri.js"
import cloudinary from "cloudinary"
import { sendToken } from "../utils/sendToken.js";
import { sendEmail } from "../utils/nodeEmail.js";
import crypto from "crypto"

export const register = catchAsyncError(async (req, res, next) => {
    const { name, email, password, username } = req.body;
    const file = req.file;

    if (!name || !email || !password || !file || !username) {
        return next(new errorHandlerClass("Please enter all field", 400))
    }

    let user = await userModel.findOne({ $or: [{ email }, { username }] });

    if (user) {
        if (user.email === email) {
            return next(new errorHandlerClass("User with this name already exists", 401))
        } if (user.username === username) {
            return next(new errorHandlerClass("User with this username already exists", 401))

        }
    }

    //upload file on cloudinary
    const fileUri = getDataUri(file);
    const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);


    user = await userModel.create({
        name,
        email,
        password,
        username,
        avatar: {
            public_id: mycloud.public_id,
            url: mycloud.secure_url,
        },
    })

    sendToken(res, user, "Registered Successfully", 201);


})


export const getMyProfile = catchAsyncError(async (req, res, next) => {
    const user = await userModel.findById(req.user._id);
    res.status(200).json({
        success: true,
        user,
    })
})

export const logout = catchAsyncError(async (req, res, next) => {
    res.status(200).cookie("token", null, {
        //Cookie to null and deltes the cookie in the browser now.
        expires: new Date(Date.now()),
        httpOnly: true,
        secure: true,
        sameSite: "none",
    }).json({
        success: true,
        message: "Logged out successfully",
    })
})

export const forgetpassword = catchAsyncError(async (req, res, next) => {

    const { email } = req.body;

    const user = await userModel.findOne({ email });
    if (!user) {
        return next(new errorHandlerClass("No user with give email found", 400));
    }

    const resetToken = await user.getResetToken();
    await user.save();
    // http://localhost:3000/resetpassword/dhfajfhdjhdkalhfjdh
    const url = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;

    const message = `Click on the link to reset your password. ${url}. if you have not requested then please ignore.`
    //send token via email
    await sendEmail(user.email, "Whisper Reset password", message)
    res.status(200).json({
        success: true,
        message: `reset token has been sent to ${user.email}`,
    })

})


export const resetpassword = catchAsyncError(async (req, res, next) => {
    const { token } = req.params;

    const resetPasswordToken = crypto.createHash("sha256")
        .update(token)
        .digest("hex");

    const user = await userModel.findOne({
        resetPasswordToken,
        resetPasswordExpire: {
            $gt: Date.now(),
        },

    })
    if (!user) {
        return next(new errorHandlerClass("Token is invalid or has been expired"));
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    user.save();

    res.status(200).json({
        success: true,
        message: "password changed successfully",
        token
    })
})

export const login = catchAsyncError(async (req, res, next) => {

    const { username, password } = req.body;


    if (!username || !password) {
        return next(new errorHandlerClass("Please enter all field", 400))
    }
    // console.log(email, password)
    let user = await userModel.findOne({ username }).select("+password");

    if (!user) {
        return next(new errorHandlerClass("Incorrect username or password", 401));
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        return next(new errorHandlerClass("Incorrect email or password", 401))
    }


    sendToken(res, user, `Welcome back, ${user.name}`, 200);
})


