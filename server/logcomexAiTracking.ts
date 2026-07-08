/**
 * Logcomex AI Agent API - Container Tracking Service
 * 
 * Uses the Logcomex AI Agent API to fetch detailed container tracking data.
 * The API is asynchronous: we POST a request, then poll until the result is ready.
 * 
 * Agent ID: 4ea89ac8-b380-467c-8eb3-2a347704b9a2
 * Prompt ID: 2e7f41e6-85c4-42af-acec-fc058a77a8f1
 * 
 * Input: { container: string, armador: string }
 * Output: Structured JSON with full tracking details
 */

const LOGCOMEX_AGENT_ID = "4ea89ac8-b380-467c-8eb3-2a347704b9a2";
const LOGCOMEX_PROMPT_ID = "2e7f41e6-85c4-42af-acec-fc058a77a8f1";
const LOGCOMEX_BASE_URL = "https://api.logcomex.ai/v1/agent-api-execute";

// Known carriers for the select dropdown
export const ARMADORES = [
  "ONE",
  "MSC",
  "MAERSK",
  "CMA CGM",
  "HAPAG-LLOYD",
  "EVERGREEN",
  "COSCO",
  "YANG MING",
  "HMM",
  "ZIM",
  "PIL",
  "WAN HAI",
  "OOCL",
] as const;

export interface LogcomexTrackingEvent {
  date: string;
  event: string;
  location: string;
  vessel: string;
  voyage: string;
  has_occurred: boolean;
}

export interface LogcomexTrackingResult {
  tracking_found: boolean;
  workflow_created: boolean;
  workflow_updated: boolean;
  tracking_id: string;
  container: string;
  carrier: string;
  booking: string;
  bl_number: string;
  vessel_name: string;
  voyage: string;
  origin_port: string;
  destination_port: string;
  eta: string;
  etd: string;
  current_status: string;
  last_event: string;
  last_event_date: string;
  operational_risk: string;
  executive_summary: string;
  events: LogcomexTrackingEvent[];
  error?: string;
  meta?: {
    request_id: string;
    prompt_id: string;
    model: string | null;
    tokens_input: number;
    tokens_output: number;
    duration_ms: number;
    replayed: boolean;
  };
}

interface PollResponse {
  success: boolean;
  status: string;
  request_id: string;
  meta?: {
    prompt_id?: string;
    async?: boolean;
    async_fallback?: boolean;
    fallback_after_ms?: number;
    replay_url?: string;
    poll_after_ms?: number;
    expires_at?: string;
  };
  // When completed, the response includes the tracking data directly
  tracking_found?: boolean;
  [key: string]: any;
}

/**
 * Fetch container tracking from Logcomex AI Agent API.
 * This is an async operation that requires polling.
 * 
 * @param container - Container number or BL number
 * @param armador - Carrier name (e.g., "ONE", "MSC", "MAERSK")
 * @param apiKey - Logcomex API key (ldi_*)
 * @param maxWaitMs - Maximum time to wait for result (default: 120s)
 * @returns Structured tracking result
 */
export async function fetchLogcomexAiTracking(
  container: string,
  armador: string,
  apiKey: string,
  maxWaitMs: number = 120000
): Promise<LogcomexTrackingResult> {
  const url = `${LOGCOMEX_BASE_URL}/${LOGCOMEX_AGENT_ID}/${LOGCOMEX_PROMPT_ID}`;
  
  // Step 1: Submit the tracking request
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

  const submitData: PollResponse = await submitResponse.json();
  
  if (!submitData.success) {
    throw new Error(`Logcomex API rejected request: ${JSON.stringify(submitData)}`);
  }

  // If the response already has tracking data (not pending), return immediately
  if (submitData.tracking_found !== undefined) {
    return submitData as unknown as LogcomexTrackingResult;
  }

  // Step 2: Poll for the result
  const requestId = submitData.request_id;
  const pollUrl = `${LOGCOMEX_BASE_URL}/${requestId}`;
  const pollInterval = submitData.meta?.poll_after_ms || 3000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const pollResponse = await fetch(pollUrl, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!pollResponse.ok) {
      throw new Error(`Logcomex poll error (${pollResponse.status})`);
    }

    const pollData: PollResponse = await pollResponse.json();

    // Check if result is ready (has tracking_found field)
    if (pollData.tracking_found !== undefined) {
      return pollData as unknown as LogcomexTrackingResult;
    }

    // Still pending, continue polling
    if (pollData.status !== "pending") {
      throw new Error(`Unexpected status: ${pollData.status}`);
    }
  }

  throw new Error(`Timeout: Logcomex AI não respondeu em ${maxWaitMs / 1000}s. Tente novamente.`);
}
