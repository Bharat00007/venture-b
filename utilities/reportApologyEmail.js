const reportApologyEmail = (email, URLToCommunityDetails) => {
    return `
    <!-- report-apology-email.html -->
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>Apology Notice | VentureFlock</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <style>
        @media only screen and (max-width: 620px) {
        .container { width:100% !important; border-radius:0 !important; }
        .content { padding:20px !important; }
        .header { padding:28px 18px !important; }
        .greeting { font-size:22px !important; }
        .message { font-size:15px !important; }
        .cta-button { display:block !important; width:100% !important; box-sizing:border-box; padding:12px !important; }
        }
    </style>
    </head>
    <body style="margin:0; padding:0; background-color:#f8f9fa; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#1f2937;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8f9fa;">
        <tr>
        <td align="center" style="padding:24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07);">
            <!-- Header -->
            <tr>
                <td class="header" style="background:#0f172a; padding:40px 30px; text-align:center;">
                <div style="font-size:28px; font-weight:700; line-height:1;">
                    <span style="color:#7c3aed;">Venture</span><span style="color:#ffffff;">Flock</span>
                </div>
                <p style="margin:10px 0 0; color:#22c55e; font-size:18px; font-weight:500;">We Owe You an Apology</p>
                </td>
            </tr>

            <!-- Content -->
            <tr>
                <td class="content" style="padding:40px 30px;">
                <h1 class="greeting" style="margin:0 0 18px; font-size:26px; font-weight:600; color:#15803d;">✅ Report Cleared</h1>

                <p class="message" style="margin:0 0 18px; font-size:16px; line-height:1.6; color:#4b5563;">
                    Recently, an activity from your account was reported by another user. After a thorough review, our moderation team has determined that the report was not valid.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
                    <tr>
                    <td style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; border-radius:0 6px 6px 0;">
                        <p style="margin:0; font-size:15px; color:#166534;">
                        Please accept our sincere apologies for any inconvenience caused. You did not violate our community guidelines.
                        </p>
                    </td>
                    </tr>
                </table>

                <p class="message" style="margin:0 0 22px; font-size:16px; line-height:1.6; color:#4b5563;">
                    We truly appreciate your positive contributions to the VentureFlock community. Thank you for maintaining a respectful and engaging environment.
                </p>

                <div class="cta-section" style="text-align:center; margin:30px 0;">
                    <a href="${URLToCommunityDetails}"
                    class="cta-button"
                    style="display:inline-block; background:linear-gradient(135deg,#22c55e,#16a34a); color:#ffffff; padding:14px 30px; text-decoration:none; border-radius:8px; font-weight:600; font-size:16px;">
                    Return to Communities
                    </a>
                </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background:#f8f9fa; padding:30px; text-align:center; border-top:1px solid #e5e7eb; font-size:14px; color:#6b7280;">
                <p style="margin:0 0 8px;"><strong>With appreciation,</strong><br>— The VentureFlock Moderation Team</p>
                <p style="margin:8px 0;">Need help? Contact us at <a href="mailto:support@ventureflock.com" style="color:#6366f1; text-decoration:none;">support@ventureflock.com</a></p>
                <p style="margin:8px 0;">This email was sent to ${email}</p>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">© 2024 <span style="color:#7c3aed;">Venture</span><span style="color:#000000;">Flock</span>. All rights reserved.</p>
                </td>
            </tr>

            </table>
        </td>
        </tr>
    </table>
    </body>
    </html>
    `
}
module.exports = reportApologyEmail;