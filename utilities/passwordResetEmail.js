/**
 * Generates a styled HTML email for password reset.
 * @param {Object} params
 * @param {string} params.email - Recipient's email
 * @param {string} params.resetLink - The password reset URL
 * @returns {string} HTML email content
 */
const generatePasswordResetEmail = ({ email, resetLink }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password</title>
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
    .title {
      font-size: 26px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #1f2937;
    }
    .message {
      font-size: 16px;
      color: #4b5563;
      line-height: 1.6;
      margin-bottom: 25px;
    }
    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
      padding: 16px 36px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 18px;
      text-align: center;
      margin: 10px;
    }
    .cta-button:hover {
      background: linear-gradient(135deg, #5855eb 0%, #7c3aed 100%);
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
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
      <p class="header-text">Secure Your Account</p>
    </div>

    <!-- Content -->
    <div class="content">
      <h1 class="title">Reset Your Password</h1>
      <p class="message">
        Hi ${email ? `<strong>${email}</strong>` : 'there'}, we received a request to reset your password for your VentureFlock account.
      </p>

      <div class="cta-section">
        <a href="${resetLink}" class="cta-button">Reset Password</a>
      </div>

      <p class="message">
        Didn’t request this? No worries — you can safely ignore this email and your password will remain unchanged.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      &copy; ${new Date().getFullYear()} <span style="color:#7c3aed;">Venture</span><span style="color:#000000;">Flock</span>. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

module.exports = generatePasswordResetEmail;
