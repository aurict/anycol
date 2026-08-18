import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getConfig } from "@anycol/config";
import { createDatabase } from "./index";

const config = getConfig();
if (!config.DATABASE_URL)
  throw new Error("DATABASE_URL is required to run migrations");
const database = createDatabase(config.DATABASE_URL);
try {
  await migrate(database.db, {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  });
  console.info("Database migrations completed");
} finally {
  await database.close();
}
