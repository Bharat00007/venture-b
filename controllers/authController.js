const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');
const pool = require('../db'); // Assuming you have a db.js file for database connection
const uploadFilesToR2 = require('../utilities/uploadFilesToR2');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, generateEmailToken, generatePasswordResetToken } = require('../utilities/tokenUtils');
const { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } = require('../utilities/emailUtils');
// const dotenv = require('dotenv');

// const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

exports.register = async (req, res) => {
  const {
    email,
    username,
    password,
    role,
    companyName,
    industry,
    yearsExperience,
    address,
    contactNo,
    ndaSignedName,
    ndaSignatureImage,
    ndaSignedAt,
    ndaSignedTime,
    ndaIpAddress,
    ndaDocumentHtml,
  } = req.body;

  if (!email || !username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!ndaSignedName || !ndaSignatureImage || !ndaSignedAt || !ndaSignedTime || !ndaIpAddress || !address || !contactNo || (typeof contactNo === 'string' && contactNo.trim() === '')) {
    return res.status(400).json({ error: 'NDA signing info, address and contact number are required' });
  }

  try {
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const emailToken = generateEmailToken();

    const signatureBuffer = ndaSignatureImage
      ? Buffer.from(
          ndaSignatureImage.includes(',')
            ? ndaSignatureImage.split(',')[1]
            : ndaSignatureImage,
          'base64'
        )
      : null;

    let ndaDocumentUrl = null;  // Declare early to use after file upload
    let ndaBuffer = null;       // Declare early to use for email attachment

    const insertUser = await pool.query(
      `INSERT INTO users (email, username, password, role, company_name, industry, years_experience, is_verified, email_verification_token, nda_signed_name, nda_signature_image, nda_signed_at, address, contact_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        email,
        username,
        hashed,
        role,
        companyName || null,
        industry || null,
        yearsExperience === '' ? null : yearsExperience,
        false,
        emailToken,
        ndaSignedName || null,
        signatureBuffer,
        ndaSignedAt ? new Date(ndaSignedAt) : new Date(),
        address || null,
        contactNo || null,
      ]
    );

    const user = insertUser.rows[0];
    if (!user) {
      return res.status(500).json({ error: 'User registration failed' });
    }

    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    const userAgent = req.get('User-Agent') || 'Unknown';

    console.log('NDA Data:', { email, username, address, contactNo, ndaSignedName, ndaSignedAt, ndaSignedTime, ndaIpAddress });

    const finalNdaDocument = ndaDocumentHtml && ndaDocumentHtml.trim().length > 0
      ? ndaDocumentHtml
      : `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Non-Disclosure Agreement</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; }
      h1 { text-align: center; font-size: 24px; margin-bottom: 30px; }
      h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #333; }
      p { margin: 10px 0; }
      .party-info { background-color: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #333; }
      .signature-section { margin-top: 40px; }
      .signature-image { margin: 20px 0; border: 1px solid #ddd; padding: 10px; display: inline-block; }
      table { width: 100%; margin: 15px 0; }
      td { padding: 8px; border-bottom: 1px solid #ddd; }
      .label { font-weight: bold; width: 30%; }
    </style>
  </head>
  <body>
    <h1>Non-Disclosure Agreement (NDA)</h1>
    
    <p style="text-align: center; margin-bottom: 30px;">This Non-Disclosure Agreement ("Agreement") is made on <strong>${ndaSignedAt}</strong></p>
    
    <h2>PARTIES TO THE AGREEMENT</h2>
    
    <div class="party-info">
      <p><strong>1. RECEIVING PARTY - VentureFlock</strong></p>
      <p>VentureFlock, a company established under the laws of India, having its principal office at India, represented by its authorized representative, hereinafter referred to as the "Receiving Party" or "VentureFlock".</p>
    </div>
    
    <div class="party-info">
      <p><strong>2. DISCLOSING PARTY - User</strong></p>
      <table>
        <tr>
          <td class="label">Name:</td>
          <td>${ndaSignedName}</td>
        </tr>
        <tr>
          <td class="label">Email:</td>
          <td>${email}</td>
        </tr>
        <tr>
          <td class="label">Contact No:</td>
          <td>${contactNo}</td>
        </tr>
        <tr>
          <td class="label">Address:</td>
          <td>${address}</td>
        </tr>
      </table>
      <p>Hereinafter referred to as the "Disclosing Party" or "User".</p>
    </div>
    
    <h2>AGREEMENT DETAILS</h2>
    <table>
      <tr>
        <td class="label">Date Signed:</td>
        <td>${ndaSignedAt}</td>
      </tr>
      <tr>
        <td class="label">Time Signed:</td>
        <td>${ndaSignedTime}</td>
      </tr>
      <tr>
        <td class="label">IP Address:</td>
        <td>${ndaIpAddress || ipAddress}</td>
      </tr>
    </table>
    
    <h2>TERMS AND CONDITIONS</h2>
    <p>VentureFlock and the User (herein collectively referred to as the "Parties" and individually as a "Party") hereby agree to maintain strict confidentiality regarding all information disclosed and shared on the VentureFlock platform.</p>
    
    <p style="margin-top: 20px;"><strong>Key Terms:</strong></p>
    <ol>
      <li>The Disclosing Party hereby discloses certain confidential and proprietary information to the Receiving Party.</li>
      <li>The Receiving Party agrees to keep such information strictly confidential and not disclose it to third parties.</li>
      <li>All confidential information shall be used solely for the purposes stated in this Agreement.</li>
      <li>This Agreement shall remain in effect for a period of 3 years from the date of signing.</li>
      <li>No modification of this Agreement shall be valid unless made in writing and signed by both parties.</li>
    </ol>
    
    <div class="signature-section">
      <h2>SIGNATURE</h2>
      <p><strong>Digital Signature of ${ndaSignedName}:</strong></p>
      <div class="signature-image">
        <img src="${ndaSignatureImage}" alt="User signature" style="max-width: 300px; height: auto; border: 1px solid #ccc;" />
      </div>
    </div>
    
    <p style="margin-top: 50px; font-size: 12px; color: #666;">
      <strong>Document Information:</strong><br>
      This NDA document is digitally signed and stored securely on Cloudflare R2 infrastructure.<br>
      This is an authenticated electronic copy of the Non-Disclosure Agreement signed by ${ndaSignedName}.<br>
      For verification purposes, this document was generated on ${new Date().toLocaleString()}.
    </p>
  </body>
</html>`;

    const tmpDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const fileName = `nda-${user.id}-${Date.now()}.pdf`;
    const localFile = path.join(tmpDir, fileName);
    
    // Convert HTML to PDF for storage
    try {
      // Convert HTML to PDF using html-pdf library
      const pdfOptions = {
        format: 'A4',
        timeout: 30000,
      };
      
      await new Promise((resolve, reject) => {
        pdf.create(finalNdaDocument, pdfOptions).toFile(localFile, (err, res) => {
          if (err) {
            console.error('❌ PDF creation failed:', err);
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      
      // Verify file was created and read into memory
      const fileExists = fs.existsSync(localFile);
      if (fileExists) {
        try {
          ndaBuffer = fs.readFileSync(localFile);
        } catch (bufferErr) {
          console.error('❌ Failed to read NDA file into memory:', bufferErr);
        }
      }
      
      // Upload to Cloudflare R2
      ndaDocumentUrl = await uploadFilesToR2(localFile, `nda/${fileName}`, 'application/pdf');
      
      // Update the users table with the NDA document URL
      await pool.query(
        `UPDATE users SET nda_document_url = $1 WHERE id = $2`,
        [ndaDocumentUrl, user.id]
      );
    } catch (uploadError) {
      console.error('Failed to upload NDA PDF to Cloudflare R2', uploadError);
    }

    try {
      const signatureBuffer = ndaSignatureImage.startsWith('data:')
        ? Buffer.from(ndaSignatureImage.split(',')[1], 'base64')
        : Buffer.from(ndaSignatureImage, 'base64');

      await pool.query(
        `INSERT INTO nda_signatures (user_id, signed_name, signature_image, signed_at, ip_address, user_agent, nda_document_url, address, contact_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.id, ndaSignedName, signatureBuffer, ndaSignedAt ? new Date(ndaSignedAt) : new Date(), ndaIpAddress || ipAddress, userAgent, ndaDocumentUrl, address, contactNo]
      );
    } catch (ndaInsertError) {
      console.error('Failed to record NDA signature audit', ndaInsertError);
    }

    try {
      await sendVerificationEmail(email, username, emailToken);
      await sendWelcomeEmail(email, username, ndaBuffer);
      
      // Clean up temporary file immediately - content is already in memory
      try {
        if (fs.existsSync(localFile)) {
          fs.unlinkSync(localFile);
        }
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    return res.status(201).json({ message: 'Registration successful. Please verify your email.', ndaDocumentUrl });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET is_verified = TRUE, email_verification_token = NULL
       WHERE email_verification_token = $1
       RETURNING *`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: 'Server error during email verification' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(403).json({ error: 'Invalid credentials' });
    }

    let storedHash = user.password;
    if (Buffer.isBuffer(storedHash)) {
      storedHash = storedHash.toString('utf8');
    }
    if (typeof storedHash === 'string') {
      storedHash = storedHash.trim();
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.id, refreshToken]
    );

    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ accessToken });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token provided' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const result = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
      [refreshToken]
    );

    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid refresh token' });
    const accessToken = generateAccessToken({ userId: payload.userId, role: payload.role });

    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.status(400).json({ error: 'No refresh token provided' });

  await pool.query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1`, [refreshToken]);

  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logged out successfully' });
};

exports.sendPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const resetToken = generatePasswordResetToken();
  await pool.query(
    `UPDATE users SET password_reset_token = $1, password_reset_expires = NOW() + INTERVAL '1 hour' WHERE id = $2`,
    [resetToken, user.id]
  );
  await sendPasswordResetEmail(email, resetToken);
  res.json({ message: 'Password reset email sent' });
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  const result = await pool.query(
    `SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
    [token]
  );
  
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query(
    `UPDATE users SET password = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2`,
    [hashed, user.id]
  );
  res.json({ message: 'Password reset successful' });
};
