const fs = require('fs');
const AWS = require('aws-sdk');
require('dotenv').config();

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ACCOUNT_ID,
  R2_REGION,
} = process.env;

const r2 = new AWS.S3({
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  region: R2_REGION,
  signatureVersion: "v4",
});

async function uploadFilesToR2(localFilePath, keyName, contentType = "image/png") {
  console.log("Trying to read file from:", localFilePath);
  const fileContent = fs.readFileSync(localFilePath);

  const params = {
    Bucket: R2_BUCKET_NAME,
    Key: keyName,
    Body: fileContent,
    ContentType: contentType,
    ACL: "public-read",
  };

  const result = await r2.upload(params).promise();
  fs.unlinkSync(localFilePath); // remove local file after upload
  return result.Location; // public URL
}

// Delete a file from R2 by key
async function deleteFromR2(keyName) {
  try {
    const params = {
      Bucket: R2_BUCKET_NAME,
      Key: keyName,
    };
    await r2.deleteObject(params).promise();
    console.log(`Deleted from R2: ${keyName}`);
  } catch (err) {
    console.error(`Failed to delete from R2: ${keyName}`, err);
  }
}

uploadFilesToR2.deleteFromR2 = deleteFromR2;

module.exports = uploadFilesToR2;
