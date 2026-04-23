/**
 * Generates a styled HTML email for welcoming new users.
 * @param {Object} params
 * @param {string} params.name - Recipient's name (optional)
 * @param {string} params.platformUrl - URL to redirect user to the platform
 * @param {string} params.email - The recipient's email address
 * @returns {string} HTML email content
 */
const generateWelcomeEmail = ({ name, platformUrl, email }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to VentureFlock!</title>
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
    .venture { color: #7c3aed; }
    .flock { color: #ffffff; }
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
      margin-bottom: 25px;
    }
    .intro-box {
      background-color: #f1f5f9;
      border-left: 4px solid #7c3aed;
      padding: 20px;
      margin: 25px 0;
      border-radius: 0 6px 6px 0;
    }
    .intro-text {
      font-size: 16px;
      color: #374151;
      margin: 0;
    }

    /* NDA SECTION */
    .nda-box {
      background-color: #f8fafc;
      border: 1px solid #e5e7eb;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }
    .nda-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .nda-text {
      font-size: 14px;
      color: #4b5563;
      line-height: 1.5;
    }
    .nda-note {
      font-size: 13px;
      color: #6b7280;
      margin-top: 10px;
    }

    .actions-list {
      background-color: #f8fafc;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .actions-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .action-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .action-icon {
      margin-right: 10px;
      font-size: 16px;
      margin-top: 2px;
    }
    .action-text {
      font-size: 15px;
      color: #374151;
    }

    .features-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 30px 0;
    }
    .feature-item {
      background-color: #f8fafc;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .feature-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .feature-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .feature-desc {
      font-size: 14px;
      color: #6b7280;
    }

    .cta-section {
      text-align: center;
      margin: 40px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #ffffff;
      padding: 16px 36px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 18px;
    }

    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }

    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 10px;
    }

    @media (max-width: 600px) {
      .features-grid {
        grid-template-columns: 1fr;
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
      <p class="header-text">Welcome to Your Entrepreneurial Journey!</p>
    </div>

    <!-- Content -->
    <div class="content">

      <h1 class="greeting">Welcome to VentureFlock${name ? `, ${name}` : ''}!</h1>

      <p class="message">
        Congratulations! Your email has been verified and your account is now active. You're all set to start connecting with like-minded entrepreneurs and professionals.
      </p>

      <div class="intro-box">
        <p class="intro-text">
          We're thrilled to have you! VentureFlock connects entrepreneurs and professionals like you through engaging, topic-based communities where ideas spark and networks grow.
        </p>
      </div>

      <!-- NDA BOX -->
      <div class="nda-box">
        <div class="nda-title">📎 Your Signed NDA</div>
        <p class="nda-text">
          A copy of your signed Non-Disclosure Agreement (NDA) is attached to this email for your records.
        </p>
        <p class="nda-note">
          Please download and keep this document safely for future reference.
        </p>
      </div>

      <div class="actions-list">
        <h3 class="actions-title">Here's what you can do to get started:</h3>

        <div class="action-item">
          <span class="action-icon">🔍</span>
          <p class="action-text">Discover communities that align with your interests and expertise</p>
        </div>

        <div class="action-item">
          <span class="action-icon">💬</span>
          <p class="action-text">Ask questions, share ideas, or start discussions</p>
        </div>

        <div class="action-item">
          <span class="action-icon">🤝</span>
          <p class="action-text">Connect and grow your network with professionals from around the world</p>
        </div>

        <div class="action-item">
          <span class="action-icon">📌</span>
          <p class="action-text">Bookmark insights and posts you care about</p>
        </div>
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon">🏘️</div>
          <h4 class="feature-title">Join Communities</h4>
          <p class="feature-desc">Follow communities that match your interests and expertise</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">✨</div>
          <h4 class="feature-title">Create Content</h4>
          <p class="feature-desc">Share questions, ideas, and discussions with the community</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">📱</div>
          <h4 class="feature-title">Mobile Ready</h4>
          <p class="feature-desc">Access VentureFlock anywhere with our responsive design</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">❤️</div>
          <h4 class="feature-title">Engage & Save</h4>
          <p class="feature-desc">Like, reply, and bookmark posts that matter to you</p>
        </div>
      </div>

      <div class="cta-section">
        <a href="${platformUrl}" class="cta-button">Explore Communities Now</a>
      </div>

      <div class="divider"></div>

      <p class="message">
        <strong>Need help or have feedback?</strong> Reply to this email or reach out to us through the Help section. We're here to help you make the most of your VentureFlock experience!
      </p>

    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        <strong>Welcome aboard,</strong><br>
        — The VentureFlock Team
      </p>
      <p class="footer-text">
        Questions? Contact us at support@ventureflock.com
      </p>
      <p class="footer-text">
        This email was sent to ${email}
      </p>
      <p class="footer-text" style="margin-top: 20px;">
        © 2024 <span style="color:#7c3aed;">Venture</span><span style="color:#000000;">Flock</span>. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
`;

module.exports = generateWelcomeEmail;
