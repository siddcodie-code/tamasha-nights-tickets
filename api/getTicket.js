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
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing id" });
  try {
    const db     = await getDB();
    const ticket = await db.collection("tickets").findOne({ ticketId: id });
    if (!ticket) return res.status(404).json({ error: "Not found" });
    res.json({ ticketId: ticket.ticketId, name: ticket.name, phone: ticket.phone, email: ticket.email, used: ticket.used });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
