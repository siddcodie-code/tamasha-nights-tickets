const { MongoClient, ServerApiVersion } = require("mongodb");
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://sidhuremma88_db_user:Y9TMYrJ1Dn5jnUV4@tamashanights.keizmhl.mongodb.net/?appName=TamashaNights";
let cachedClient = null;
async function getDB() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URI, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }, tls: true, tlsAllowInvalidCertificates: true });
    await cachedClient.connect();
  }
  return cachedClient.db("tamashanights");
}
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
module.exports = async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { ticketId } = req.body;
  if (!ticketId) return res.status(400).json({ error: "No ticketId" });
  try {
    const db         = await getDB();
    const collection = db.collection("tickets");
    const ticket     = await collection.findOne({ ticketId });
    if (!ticket) return res.json({ valid: false, reason: "not_found" });
    if (ticket.used) {
      return res.json({ valid: false, reason: "used", name: ticket.name, usedAt: ticket.usedAt ? new Date(ticket.usedAt).toLocaleTimeString("en-IN") : "earlier" });
    }
    await collection.updateOne({ ticketId }, { $set: { used: true, usedAt: new Date() } });
    console.log(`✅ Entry granted: ${ticketId} — ${ticket.name}`);
    res.json({ valid: true, name: ticket.name, ticketId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
