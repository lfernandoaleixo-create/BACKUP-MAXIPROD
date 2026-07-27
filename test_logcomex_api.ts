import { fetchLogcomexAiTracking } from "./server/logcomexAiTracking";

async function main() {
  const apiKey = process.env.LOGCOMEX_API_KEY;
  if (!apiKey) { console.log("No LOGCOMEX_API_KEY"); process.exit(1); }
  
  console.log("=== Testing Logcomex AI API for HANK container ===");
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`Container: YMLU5427811 | Armador: COSCO`);
  console.log("Calling API...\n");
  
  try {
    const result = await fetchLogcomexAiTracking("YMLU5427811", "COSCO", apiKey, 60000);
    console.log("=== API RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("ERROR:", err.message);
  }
  
  process.exit(0);
}
main();
