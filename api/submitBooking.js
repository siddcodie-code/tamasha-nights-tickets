const { MongoClient, ServerApiVersion } = require("mongodb");

// KEY FIX: added /tamashanights before the ? so it creates+uses the right database
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://sidhuremma88_db_user:Y9TMYrJ1Dn5jnUV4@tamashanights.keizmhl.mongodb.net/tamashanights?retryWrites=true&w=majority&appName=TamashaNights";

let cachedClient = null;

async function getDB() {
  if (cachedClient) {
    try {
      await cachedClient.db("admin").command({ ping: 1 });
      return cachedClient.db("tamashanights");
    } catch (e) {
      cachedClient = null;
    }
  }

  cachedClient = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    tls: true,
    tlsAllowInvalidCertificates: false,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await cachedClient.connect();
  console.log("MongoDB connected");
  return cachedClient.db("tamashanights");
}

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function genBookingId() {
  return "BK-" + Date.now().toString(36).toUpperCase() + "-" +
    Math.random().toString(36).substring(2, 5).toUpperCase();
}

module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, phone, email, qty, utr, total } = req.body;

  if (!name || !phone || !email || !qty || !utr) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const db = await getDB();
    const bookingId = genBookingId();

    await db.collection("bookings").insertOne({
      bookingId,
      name:      name.trim(),
      phone:     phone.trim(),
      email:     email.trim().toLowerCase(),
      qty:       parseInt(qty),
      total:     parseInt(total) || parseInt(qty) * 100,
      utr:       utr.trim(),
      status:    "pending",
      ticketIds: [],
      createdAt: new Date(),
    });

    console.log("Booking saved: " + bookingId + " - " + name);
    res.status(201).json({ success: true, bookingId });

  } catch (err) {
    console.error("submitBooking error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
