const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// POST /api/contact
router.post('/', [
  body('message').notEmpty().withMessage('Message is required'),
], async (req, res) => {
  // common validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // grab fields, allow optional name/email for feedback
  const { name = 'Anonymous', email = 'noreply@ventureflock.com', message, type, rating, company } = req.body;

  // construct subject based on type
  let subject = 'New Website Message';
  if (type === 'feedback') {
    subject = 'New Website Feedback';
    if (rating != null) {
      subject += ` (${rating}/5)`;
    }
  }

  let bodyText = `Name: ${name}\nEmail: ${email}\n`;
  if (company) {
    bodyText += `Company: ${company}\n`;
  }
  if (type) {
    bodyText += `Type: ${type}\n`;
  }
  if (rating != null) {
    bodyText += `Rating: ${rating}/5\n`;
  }
  bodyText += `Message: ${message}`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: 'contact@ventureflock.com',
      subject,
      text: bodyText,
    });

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

module.exports = router;