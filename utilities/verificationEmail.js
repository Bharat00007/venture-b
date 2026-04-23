/**
 * Generates a styled HTML email for email verification.
 * @param {Object} params
 * @param {string} params.name - Recipient's name (optional, not used in this template)
 * @param {string} params.verificationLink - The verification URL
 * @param {string} params.email - The recipient's email address
 * @returns {string} HTML email content
 */
const generateVerificationEmail = ({ verificationLink, email }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Email | VentureFlock</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      background-color: #f8f9fa;
      color: #1f2937;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    }
    .header {
      background-color: #0f172a;
      padding: 40px 30px;
      text-align: center;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    .venture {
      color: #7c3aed;
    }
    .flock {
      color: #ffffff;
    }
    .header-text {
      color: #cbd5e1;
      font-size: 18px;
      margin: 0;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 26px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    .verify-btn {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff;
      padding: 14px 30px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      text-align: center;
      transition: background 0.3s ease;
    }
    .verify-btn:hover {
      background: linear-gradient(135deg, #5855eb, #7c3aed);
    }
    .footer {
      background-color: #f1f5f9;
      padding: 25px 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
    @media (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <span class="venture">Venture</span><span class="flock">Flock</span>
      </div>
      <p class="header-text">Let’s get you started!</p>
    </div>

    <!-- Body Content -->
    <div class="content">
      <h1 class="greeting">Verify your email</h1>
      <p class="message">
        Thanks for signing up! To complete your registration, please verify your email address by clicking the button below.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" class="verify-btn">Verify My Email</a>
      </div>
      <p class="message" style="font-size: 15px; color: #6b7280;">
        If you did not sign up for VentureFlock, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        Need help? Contact us at 
        <a href="mailto:support@ventureflock.com">support@ventureflock.com</a>
      </p>
      <p>
        This email was sent to ${email}
      </p>
      <p class="footer-text" style="margin-top: 20px;">© ${new Date().getFullYear()} <span style="color:#7c3aed;">Venture</span><span style="color:#000000;">Flock</span>. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = generateVerificationEmail;
