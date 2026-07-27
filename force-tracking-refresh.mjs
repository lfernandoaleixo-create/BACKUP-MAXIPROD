import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const LOGCOMEX_AGENT_ID = "4ea89ac8-b380-467c-8eb3-2a347704b9a2";
const LOGCOMEX_PROMPT_ID = "2e7f41e6-85c4-42af-acec-fc058a77a8f1";
const LOGCOMEX_BASE_URL = "https://api.logcomex.ai/v1/agent-api-execute";

async function fetchLogcomexAi(container, armador, apiKey) {
  const url = `${LOGCOMEX_BASE_URL}/${LOGCOMEX_AGENT_ID}/${LOGCOMEX_PROMPT_ID}`;
  console.log(`[Logcomex AI] Requesting tracking for ${container} (${armador})...`);
  
  const submitResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ container, armador }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Logcomex API error (${submitResponse.status}): ${errorText}`);
  }

  const submitData = await submitResponse.json();
  console.log(`[Logcomex AI] Submit response:`, JSON.stringify(submitData).substring(0, 200));
  
  if (!submitData.success) {
    throw new Error(`Logcomex API rejected: ${JSON.stringify(submitData)}`);
  }

  // If already has tracking data
  if (submitData.tracking_found !== undefined) {
    return submitData;
  }

  // Poll for result
  const requestId = submitData.request_id;
  const pollUrl = `${LOGCOMEX_BASE_URL}/${requestId}`;
  const pollInterval = submitData.meta?.poll_after_ms || 5000;
  const maxWait = 120000;
  const startTime = Date.now();

  console.log(`[Logcomex AI] Polling request ${requestId}...`);
  
  while (Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const pollResponse = await fetch(pollUrl, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    if (!pollResponse.ok) {
      throw new Error(`Poll error (${pollResponse.status})`);
    }

    const pollData = await pollResponse.json();
    console.log(`[Logcomex AI] Poll status: ${pollData.status || 'completed'}, tracking_found: ${pollData.tracking_found}`);
    
    if (pollData.tracking_found !== undefined) {
      return pollData;
    }

    if (pollData.status !== "pending") {
      throw new Error(`Unexpected status: ${pollData.status}`);
    }
  }

  throw new Error("Timeout waiting for Logcomex AI response");
}

async function main() {
  const apiKey = process.env.LOGCOMEX_API_KEY;
  if (!apiKey) {
    console.error("LOGCOMEX_API_KEY not set!");
    process.exit(1);
  }
  console.log(`API Key: ${apiKey.substring(0, 8)}...`);

  const conn = await createConnection(process.env.DATABASE_URL);

  // 1. HANK-CARRY: Try with BL SHYY26074853 (COSCO)
  console.log("\n=== HANK-CARRY (COSCO) ===");
  try {
    // Try with BL number first
    const result1 = await fetchLogcomexAi("SHYY26074853", "COSCO", apiKey);
    console.log("[HANK-CARRY BL] Result:", JSON.stringify(result1, null, 2).substring(0, 500));
    
    if (result1.tracking_found) {
      // Calculate progress
      let progress = null;
      if (result1.etd && result1.eta) {
        const etdDate = new Date(result1.etd);
        const etaDate = new Date(result1.eta);
        const now = new Date();
        const totalDuration = etaDate.getTime() - etdDate.getTime();
        if (totalDuration > 0) {
          const elapsed = now.getTime() - etdDate.getTime();
          progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        }
      }

      // Update tracking_cache for container key YMLU5427811
      const cacheData = {
        tracking_source: 'logcomex_ai',
        status: result1.current_status || null,
        vessel_name: result1.vessel_name || null,
        voyage_no: result1.voyage || null,
        origin: result1.origin_port || null,
        destination: result1.destination_port || null,
        etd: result1.etd || null,
        eta: result1.eta || null,
        progress,
        vessel_lat: null,
        vessel_lng: null,
        raw_data: JSON.stringify(result1),
        last_updated: new Date(),
      };

      // Update existing entry for YMLU5427811
      const [existing] = await conn.execute("SELECT id FROM tracking_cache WHERE bl_number = 'YMLU5427811'");
      if (existing.length > 0) {
        await conn.execute(
          "UPDATE tracking_cache SET tracking_source=?, status=?, vessel_name=?, voyage_no=?, origin=?, destination=?, etd=?, eta=?, progress=?, raw_data=?, last_updated=NOW() WHERE id=?",
          [cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data, existing[0].id]
        );
        console.log("[HANK-CARRY] Updated tracking_cache entry");
      } else {
        await conn.execute(
          "INSERT INTO tracking_cache (bl_number, tracking_source, status, vessel_name, voyage_no, origin, destination, etd, eta, progress, raw_data, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
          ['YMLU5427811', cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data]
        );
        console.log("[HANK-CARRY] Inserted new tracking_cache entry");
      }

      // Also insert/update for BL key SHYY26074853
      const [existingBl] = await conn.execute("SELECT id FROM tracking_cache WHERE bl_number = 'SHYY26074853'");
      if (existingBl.length > 0) {
        await conn.execute(
          "UPDATE tracking_cache SET tracking_source=?, status=?, vessel_name=?, voyage_no=?, origin=?, destination=?, etd=?, eta=?, progress=?, raw_data=?, last_updated=NOW() WHERE id=?",
          [cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data, existingBl[0].id]
        );
      } else {
        await conn.execute(
          "INSERT INTO tracking_cache (bl_number, tracking_source, status, vessel_name, voyage_no, origin, destination, etd, eta, progress, raw_data, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
          ['SHYY26074853', cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data]
        );
      }
      console.log("[HANK-CARRY] BL cache also updated");
    }
  } catch (err) {
    console.error("[HANK-CARRY] Error:", err.message);
    
    // Try with container number as fallback
    console.log("[HANK-CARRY] Trying with container YMLU5427811...");
    try {
      const result1b = await fetchLogcomexAi("YMLU5427811", "COSCO", apiKey);
      console.log("[HANK-CARRY container] Result:", JSON.stringify(result1b, null, 2).substring(0, 500));
    } catch (err2) {
      console.error("[HANK-CARRY container] Also failed:", err2.message);
    }
  }

  // Wait between requests
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. BETTY-FUSHENG: Try with container TRIU8991531 (ONE)
  console.log("\n=== BETTY-FUSHENG (ONE) ===");
  try {
    const result2 = await fetchLogcomexAi("TRIU8991531", "ONE", apiKey);
    console.log("[BETTY-FUSHENG container] Result:", JSON.stringify(result2, null, 2).substring(0, 500));
    
    if (result2.tracking_found) {
      let progress = null;
      if (result2.etd && result2.eta) {
        const etdDate = new Date(result2.etd);
        const etaDate = new Date(result2.eta);
        const now = new Date();
        const totalDuration = etaDate.getTime() - etdDate.getTime();
        if (totalDuration > 0) {
          const elapsed = now.getTime() - etdDate.getTime();
          progress = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        }
      }

      const cacheData = {
        tracking_source: 'logcomex_ai',
        status: result2.current_status || null,
        vessel_name: result2.vessel_name || null,
        voyage_no: result2.voyage || null,
        origin: result2.origin_port || null,
        destination: result2.destination_port || null,
        etd: result2.etd || null,
        eta: result2.eta || null,
        progress,
        raw_data: JSON.stringify(result2),
      };

      // Update/insert for container key TRIU8991531
      const [existing] = await conn.execute("SELECT id FROM tracking_cache WHERE bl_number = 'TRIU8991531'");
      if (existing.length > 0) {
        await conn.execute(
          "UPDATE tracking_cache SET tracking_source=?, status=?, vessel_name=?, voyage_no=?, origin=?, destination=?, etd=?, eta=?, progress=?, raw_data=?, last_updated=NOW() WHERE id=?",
          [cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data, existing[0].id]
        );
        console.log("[BETTY-FUSHENG] Updated tracking_cache entry");
      } else {
        await conn.execute(
          "INSERT INTO tracking_cache (bl_number, tracking_source, status, vessel_name, voyage_no, origin, destination, etd, eta, progress, raw_data, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
          ['TRIU8991531', cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data]
        );
        console.log("[BETTY-FUSHENG] Inserted new tracking_cache entry");
      }

      // Also insert for BL key HKGGC5520800
      const blKey = 'HKGGC5520800';
      const [existingBl] = await conn.execute("SELECT id FROM tracking_cache WHERE bl_number = ?", [blKey]);
      if (existingBl.length > 0) {
        await conn.execute(
          "UPDATE tracking_cache SET tracking_source=?, status=?, vessel_name=?, voyage_no=?, origin=?, destination=?, etd=?, eta=?, progress=?, raw_data=?, last_updated=NOW() WHERE id=?",
          [cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data, existingBl[0].id]
        );
      } else {
        await conn.execute(
          "INSERT INTO tracking_cache (bl_number, tracking_source, status, vessel_name, voyage_no, origin, destination, etd, eta, progress, raw_data, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
          [blKey, cacheData.tracking_source, cacheData.status, cacheData.vessel_name, cacheData.voyage_no, cacheData.origin, cacheData.destination, cacheData.etd, cacheData.eta, cacheData.progress, cacheData.raw_data]
        );
      }
      console.log("[BETTY-FUSHENG] BL cache also updated");
    }
  } catch (err) {
    console.error("[BETTY-FUSHENG] Error:", err.message);
  }

  await conn.end();
  console.log("\n=== DONE ===");
}

main().catch(e => { console.error(e); process.exit(1); });
