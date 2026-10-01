import mongoose from "mongoose";
import { connectDB } from "../config/db";

async function verify() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    console.error("Database connection not ready");
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  console.log(`\n================ AttendIQ Database Audit ================`);
  console.log(`Total Collections Found: ${collections.length}\n`);

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    const indexes = await db.collection(col.name).indexes();
    const indexSummary = indexes.map((idx) => Object.keys(idx.key).join("+")).join(", ");
    console.log(`📦 Collection: ${col.name.padEnd(20)} | Documents: ${String(count).padStart(3)} | Indexes (${indexes.length}): [${indexSummary}]`);
  }
  console.log(`=========================================================\n`);
  await mongoose.disconnect();
  process.exit(0);
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
