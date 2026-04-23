const reportWarningEmail = (email, URLToProfile, URLToCommunityDetails) => {
    return `
    <!-- report-warning-email.html -->
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>Important Notice | VentureFlock</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <style>
        /* Mobile tweaks */
        @media only screen and (max-width: 620px) {
        .container { width: 100% !important; border-radius: 0 !important; }
        .content { padding: 20px !important; }
        .header { padding: 28px 18px !important; }
        .greeting { font-size: 22px !important; }
        .message { font-size: 15px !important; }
        .cta-button { display: block !important; width: 100% !important; box-sizing: border-box; padding: 12px !important; }
        }
    </style>
    </head>
    <body style="margin:0; padding:0; background-color:#f8f9fa; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#1f2937;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8f9fa; width:100%; min-width:100%;">
        <tr>
        <td align="center" style="padding:24px;">
            <!-- container -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.07);">
            <!-- Header -->
            <tr>
                <td class="header" style="background:#0f172a; padding:40px 30px; text-align:center;">
                <div style="font-size:28px; font-weight:700; line-height:1;">
                    <span style="color:#7c3aed;">Venture</span><span style="color:#ffffff;">Flock</span>
                </div>
                <p style="margin:10px 0 0; color:#f87171; font-size:18px; font-weight:500;">Important Notice Regarding Your Account</p>
                </td>
            </tr>

            <!-- Content -->
            <tr>
                <td class="content" style="padding:40px 30px;">
                <h1 class="greeting" style="margin:0 0 18px; font-size:26px; font-weight:600; color:#b91c1c;">⚠️ Warning Issued</h1>

                <p class="message" style="margin:0 0 18px; font-size:16px; line-height:1.6; color:#4b5563;">
                    One of your activities on VentureFlock has been reported by another user. After review, our moderation team has accepted the report.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0;">
                    <tr>
                    <td style="background:#fef2f2; border-left:4px solid #dc2626; padding:16px; border-radius:0 6px 6px 0;">
                        <p style="margin:0; font-size:15px; color:#991b1b;">
                        Please carefully review our
                        <a href="${URLToCommunityDetails}" style="color:#dc2626; text-decoration:none;">Community Guidelines</a>
                        to ensure your future participation remains respectful and constructive.
                        </p>
                    </td>
                    </tr>
                </table>

                <p class="message" style="margin:0 0 22px; font-size:16px; line-height:1.6; color:#4b5563;">
                    Continued violations may lead to temporary suspension or permanent removal from the platform. We value your contributions and encourage you to stay engaged positively.
                </p>

                <div class="cta-section" style="text-align:center; margin:30px 0;">
                    <a href="${URLToProfile}"
                    class="cta-button"
                    style="display:inline-block; background:linear-gradient(135deg,#ef4444,#dc2626); color:#ffffff; padding:14px 30px; text-decoration:none; border-radius:8px; font-weight:600; font-size:16px;">
                    Review My Account
                    </a>
                </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background:#f8f9fa; padding:30px; text-align:center; border-top:1px solid #e5e7eb; font-size:14px; color:#6b7280;">
                <p style="margin:0 0 8px;"><strong>Stay mindful,</strong><br>— The VentureFlock Moderation Team</p>
                <p style="margin:8px 0;">Need help? Contact us at <a href="mailto:support@ventureflock.com" style="color:#6366f1; text-decoration:none;">support@ventureflock.com</a></p>
                <p style="margin:8px 0;">This email was sent to ${email} </p>
                <p style="margin-top:16px; font-size:13px; color:#6b7280;">© 2024 <span style="color:#7c3aed;">Venture</span><span style="color:#000000;">Flock</span>. All rights reserved.</p>
                </td>
            </tr>

            </table>
            <!-- /container -->
        </td>
        </tr>
    </table>
    </body>
    </html>
    `
}
module.exports = reportWarningEmail;