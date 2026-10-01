import mongoose from "mongoose";
import { config } from "./env";

export const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`[MongoDB] Connected: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (error) {
    console.warn(`[MongoDB] Connection warning (running in offline/disconnected mode if DB unavailable):`, error);
  }
};
