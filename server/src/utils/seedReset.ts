import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { seedDefaultUsers } from "./seedAuth";
import { seedAllData } from "./seedData";
import { runMigrations } from "./migrations";

/**
 * DESTRUCTIVE: drops every collection in the configured database and rebuilds the demo dataset.
 * Usage: npm run seed:reset -- --yes
 */
const run = async () => {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes ALL data in the configured database. Re-run with:  npm run seed:reset -- --yes");
    process.exit(1);
  }
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error("MongoDB is not connected");
  const db = mongoose.connection.db!;
  console.log(`[Reset] Dropping all collections in "${db.databaseName}"...`);
  for (const c of await db.listCollections().toArray()) {
    await db.dropCollection(c.name);
  }
  // Recreate indexes (unique constraints, TTL) before inserting data
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await seedDefaultUsers();
  await seedAllData();
  await runMigrations();
  await mongoose.disconnect();
  console.log("[Reset] Done.");
};

run().catch((err) => {
  console.error("[Reset] Failed:", err);
  process.exit(1);
});
