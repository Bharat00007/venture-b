const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
dotenv.config();

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

exports.generateAccessToken = function (payload, expiresIn = '15m') {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn });
};

exports.generateRefreshToken = function (payload, expiresIn = '7d') {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn });
};

exports.verifyAccessToken = function (token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
};

exports.verifyRefreshToken = function (token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
};

exports.generateEmailToken = function () {
  return uuidv4();
};

exports.generatePasswordResetToken = function () {
  return uuidv4();
};