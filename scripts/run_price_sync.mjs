import { syncPriceTables } from "../server/priceTableSync.ts";

async function main() {
  try {
    console.log("Starting price table sync...");
    const result = await syncPriceTables();
    console.log(`Done! Synced ${result.tables} tables, ${result.items} items`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
