const { MongoClient, ServerApiVersion } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://sidhuremma88_db_user:Y9TMYrJ1Dn5jnUV4@tamashanights.keizmhl.mongodb.net/tamashanights?retryWrites=true&w=majority&appName=TamashaNights";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";
const WHATSAPP_NUMBER = "919168920987";

let cachedClient = null;

async function getDB() {
  if (cachedClient) {
    try {
      await cachedClient.db("admin").command({ ping: 1 });
      return cachedClient.db("tamashanights");
    } catch (e) { cachedClient = null; }
  }
  cachedClient = new MongoClient(MONGO_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    tls: true, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
  });
  await cachedClient.connect();
  return cachedClient.db("tamashanights");
}

// CORS headers — allow both Netlify and any origin
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function genTicketId() {
  const num = Math.floor(Math.random() * 900) + 100;
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TN-${num}-${suffix}`;
}

// Send email using Resend REST API directly (no npm package needed)
async function sendTicketEmail(booking, ticketId) {
  if (!RESEND_API_KEY) {
    console.warn("No RESEND_API_KEY — skipping email");
    return { skipped: true };
  }

  const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi! My ticket ID is ${ticketId} for Tamasha Nights. Booking ref: ${booking.bookingId}`
  )}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;}
.wrap{max-width:520px;margin:0 auto;background:#0a0a0a;}
.header{background:#1a0800;padding:36px 32px;text-align:center;border-bottom:2px solid #ff4500;}
.header h1{color:#ff4500;font-size:26px;font-weight:900;letter-spacing:3px;margin:0 0 4px;text-transform:uppercase;}
.header p{color:#888;font-size:12px;margin:0;letter-spacing:1px;}
.body{padding:28px 32px;}
.hi{color:#fff;font-size:15px;margin:0 0 18px;}
.confirmed{background:#0d2a0d;border:1px solid #1a5c1a;border-radius:10px;padding:12px 16px;margin:0 0 20px;color:#4caf50;font-size:14px;font-weight:600;text-align:center;}
.ticket{border:2px dashed #ff4500;border-radius:14px;padding:24px;text-align:center;margin:0 0 20px;background:#111;}
.ticket-label{color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;}
.ticket-id{color:#ff4500;font-size:34px;font-weight:900;letter-spacing:4px;margin:0 0 4px;}
.ticket-name{color:#fff;font-size:14px;margin:0;}
.details{background:#111;border-radius:10px;overflow:hidden;margin:0 0 20px;}
.row{display:flex;justify-content:space-between;padding:11px 16px;border-bottom:1px solid #1a1a1a;}
.row:last-child{border-bottom:none;}
.lbl{color:#666;font-size:13px;}
.val{color:#fff;font-size:13px;font-weight:600;}
.wa{display:block;background:#25D366;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:10px;font-weight:700;font-size:14px;margin:0 0 14px;}
.note{color:#555;font-size:12px;text-align:center;line-height:1.6;}
.footer{background:#050505;padding:18px 32px;text-align:center;border-top:1px solid #1a1a1a;}
.footer p{color:#444;font-size:11px;margin:0;letter-spacing:1px;}
</style></head>
<body><div class="wrap">
<div class="header"><h1>Tamasha Nights</h1><p>YOUR TICKET IS CONFIRMED</p></div>
<div class="body">
<p class="hi">Hey <strong style="color:#ff4500;">${booking.name}</strong>! You're in. Payment verified!</p>
<div class="confirmed">Payment verified — Ticket confirmed</div>
<div class="ticket">
  <p class="ticket-label">Your Ticket ID</p>
  <p class="ticket-id">${ticketId}</p>
  <p class="ticket-name">${booking.name} &middot; ${booking.qty} ticket${booking.qty > 1 ? "s" : ""}</p>
</div>
<div class="details">
  <div class="row"><span class="lbl">Booking Ref</span><span class="val">${booking.bookingId}</span></div>
  <div class="row"><span class="lbl">Name</span><span class="val">${booking.name}</span></div>
  <div class="row"><span class="lbl">Tickets</span><span class="val">${booking.qty} x Rs.200 = Rs.${booking.qty * 200}</span></div>
  <div class="row"><span class="lbl">UTR</span><span class="val">${booking.utr}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val" style="color:#4caf50;">CONFIRMED</span></div>
</div>
<a href="${whatsappLink}" class="wa">Contact us on WhatsApp</a>
<p class="note">Show this ticket ID at the entry gate.<br>Screenshot this email or save your ticket ID.</p>
</div>
<div class="footer"><p>TAMASHA NIGHTS &middot; Questions? WhatsApp 9168920987</p></div>
</div></body></html>`;

  // Using fetch (built-in Node 18+) — NO npm package needed
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: booking.email,
      subject: `Your ticket ${ticketId} — Tamasha Nights`,
      html,
    }),
  });

  const result = await response.json();
  console.log("Resend response:", JSON.stringify(result));
  return result;
}

module.exports = async (req, res) => {
  setCORS(res);

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { bookingId } = req.body;
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  try {
    const db = await getDB();
    const booking = await db.collection("bookings").findOne({ bookingId });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.status === "approved") {
      return res.json({
        success: true,
        ticketIds: booking.ticketIds,
        alreadyApproved: true,
        message: "Already approved"
      });
    }

    const ticketIds = Array.from({ length: booking.qty }, () => genTicketId());

    await db.collection("bookings").updateOne(
      { bookingId },
      { $set: { status: "approved", ticketIds, approvedAt: new Date() } }
    );

    // Send email — use fetch, no resend package needed
    const emailResult = await sendTicketEmail(booking, ticketIds[0]);
    console.log(`Approved: ${bookingId} -> tickets: ${ticketIds.join(", ")}`);

    res.json({
      success: true,
      ticketIds,
      emailSent: !emailResult?.skipped,
    });

  } catch (err) {
    console.error("approveBooking error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
