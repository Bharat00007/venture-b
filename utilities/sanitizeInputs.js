const { body } = require('express-validator');

const sanitizeLogin = [
  body('email').trim().escape().isEmail(),
  body('password').trim().escape(),
];

module.exports = {
  sanitizeLogin,
};