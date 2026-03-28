const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGO_URI   = process.env.MONGO_URI   || "mongodb+srv://sidhuremma88_db_user:Y9TMYrJ1Dn5jnUV4@tamashanights.keizmhl.mongodb.net/?appName=TamashaNights";
const RESEND_KEY  = process.env.RESEND_KEY  || "re_6ca4aaa7-face-48eb-b473-8e1cea60b991";
const SITE_URL    = process.env.SITE_URL    || "https://tamasha-nights.netlify.app";

let cachedClient = null;
async function getDB() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URI, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      tls: true, tlsAllowInvalidCertificates: true
    });
    await cachedClient.connect();
  }
  return cachedClient.db("tamashanights");
}

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function genTicketId(index) {
  const num = String(index).padStart(3, "0");
  return `TN-${num}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
}

async function sendEmail(to, name, tickets) {
  const ticketLinks = tickets.map(t =>
    `<a href="${SITE_URL}/ticket.html?id=${t}" style="display:block;background:#ff3c3c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-family:monospace;font-size:13px;margin-bottom:8px;text-align:center;">🎟 ${t} — OPEN TICKET</a>`
  ).join("");

  const html = `
<!DOCTYPE html>
<html>
<body style="background:#0a0a0a;margin:0;padding:40px 20px;font-family:'DM Sans',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#141414;border-radius:20px;overflow:hidden;border:1px solid #2a2a2a;">
    <div style="background:#ff3c3c;padding:24px;text-align:center;">
      <h1 style="font-family:'Bebas Neue',Georgia,serif;font-size:36px;color:#fff;margin:0;letter-spacing:2px;">🎤 TAMASHA NIGHTS</h1>
      <p style="color:rgba(255,255,255,.8);font-size:12px;margin:6px 0 0;letter-spacing:3px;font-family:monospace;">BHIWANDI'S FIRST STANDUP NIGHT</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#f5f0e8;font-size:24px;margin:0 0 8px;">Hey ${name}! 🎉</h2>
      <p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Your ticket is confirmed! Open the link below at entry to show your QR code.
      </p>
      <div style="background:#0a0a0a;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="color:#888;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;font-family:monospace;">EVENT DETAILS</p>
        <p style="color:#f5f0e8;font-size:14px;margin:0;line-height:1.8;">
          📅 April 12, 2026 · 7:00 PM<br/>
          📍 Bhiwandi<br/>
          💰 ₹100 per ticket
        </p>
      </div>
      <p style="color:#888;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;font-family:monospace;">YOUR TICKET(S)</p>
      ${ticketLinks}
      <div style="background:#1e1e1e;border-radius:10px;padding:14px;margin-top:20px;">
        <p style="color:#888;font-size:11px;line-height:1.6;margin:0;font-family:monospace;">
          ⚡ Open ticket link at entry<br/>
          🚫 Screenshots won't work — QR is live<br/>
          🔒 One-time scan only · Non-transferable
        </p>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a;text-align:center;">
      <p style="color:#888;font-size:10px;font-family:monospace;margin:0;">Questions? WhatsApp 9168920987</p>
    </div>
  </div>
</body>
</html>`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Tamasha Nights <onboarding@resend.dev>",
      to: [to],
      subject: `🎤 Your Tamasha Nights Ticket — ${tickets.join(", ")}`,
      html
    })
  });

  const result = await emailRes.json();
  if (!emailRes.ok) throw new Error(result.message || "Email failed");
  return result;
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: "Missing bookingId" });

  try {
    const db       = await getDB();
    const bookings = db.collection("bookings");
    const tickets  = db.collection("tickets");

    const booking = await bookings.findOne({ bookingId });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status === "approved") return res.json({ success: true, message: "Already approved" });

    // Get current ticket count for sequential IDs
    const ticketCount = await tickets.countDocuments();
    const ticketIds   = [];

    for (let i = 0; i < booking.qty; i++) {
      const ticketId = genTicketId(ticketCount + i + 1);
      await tickets.insertOne({
        ticketId,
        bookingId,
        name:      booking.name,
        phone:     booking.phone,
        email:     booking.email,
        used:      false,
        usedAt:    null,
        createdAt: new Date()
      });
      ticketIds.push(ticketId);
    }

    // Update booking status
    await bookings.updateOne(
      { bookingId },
      { $set: { status: "approved", ticketIds, approvedAt: new Date() } }
    );

    // Send email
    try {
      await sendEmail(booking.email, booking.name.split(" ")[0], ticketIds);
      console.log(`📧 Email sent to ${booking.email}`);
    } catch (emailErr) {
      console.warn("Email failed (non-fatal):", emailErr.message);
    }

    console.log(`✅ Approved: ${bookingId} — ${ticketIds.join(", ")}`);
    res.json({ success: true, ticketIds });

  } catch (err) {
    console.error("approveBooking error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
