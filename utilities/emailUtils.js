const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const generateVerificationEmail = require('./verificationEmail');
const generateWelcomeEmail = require('./welcomeEmail');
const generatePasswordResetEmail = require('./passwordResetEmail');
const reportWarningEmail = require('./reportWarningEmail');
const reportApologyEmail = require('./reportApologyEmail');
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(email, name, token) {
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const html = generateVerificationEmail({ verificationLink: link , email });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@ventureflock.com',
    to: email,
    subject: 'Verify your email',
    html,
  });
}

async function sendWelcomeEmail(email, name, ndaData = null) {
  const platformUrl = `${process.env.FRONTEND_URL}/explore-communities`;
  const html = generateWelcomeEmail({ name , platformUrl , email});
  
  // Prepare attachments if NDA data is provided (can be Buffer or file path)
  const attachments = [];
  
  if (ndaData) {
    try {
      const fs = require('fs');
      
      if (Buffer.isBuffer(ndaData)) {
        attachments.push({
          filename: 'NDA_Signed.pdf',
          content: ndaData,
          contentType: 'application/pdf',
        });
      } else if (typeof ndaData === 'string' && fs.existsSync(ndaData)) {
        attachments.push({
          filename: 'NDA_Signed.pdf',
          path: ndaData,
          contentType: 'application/pdf',
        });
      }
    } catch (err) {
      // Continue sending email even if attachment fails
    }
  }
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@ventureflock.com',
    to: email,
    subject: 'Welcome to VentureFlock!',
    html,
    attachments,
  });
}

async function sendPasswordResetEmail(email, token) {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const html = generatePasswordResetEmail({ email , resetLink });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@ventureflock.com',
    to: email,
    subject: 'Reset your password',
    html,
  });
}

async function sendReportWarningEmail(email, URLtoReportedUserProfile, URLtoCommunityDetails) {
  const html = reportWarningEmail(email, URLtoReportedUserProfile, URLtoCommunityDetails);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@ventureflock.com',
    to: email,
    subject: 'Warning Issued | VentureFlock',
    html,
  });
}

async function sendReportApologyEmail(email, URLToCommunityDetails) {
  const html = reportApologyEmail(email, URLToCommunityDetails);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@ventureflock.com',
    to: email,
    subject: 'Apology Notice | VentureFlock',
    html,
  });
}

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendReportWarningEmail,
  sendReportApologyEmail,
};