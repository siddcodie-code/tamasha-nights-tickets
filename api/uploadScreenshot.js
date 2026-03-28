// Netlify Function: api/uploadScreenshot.js
// Uses Cloudinary free tier (25GB storage, no credit card needed)
// Sign up at cloudinary.com → get CLOUD_NAME, UPLOAD_PRESET (unsigned)

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET; // create unsigned preset in Cloudinary dashboard

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Cloudinary not configured" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { imageBase64, bookingId } = body;

    if (!imageBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No image provided" }) };
    }

    // Upload to Cloudinary
    const formData = new URLSearchParams();
    formData.append("file", imageBase64);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("folder", "tamasha-payments");
    formData.append("public_id", `payment-${bookingId || Date.now()}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Cloudinary upload failed");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, url: data.secure_url }),
    };
  } catch (err) {
    console.error("uploadScreenshot error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
