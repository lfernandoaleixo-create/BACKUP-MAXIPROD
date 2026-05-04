/**
 * Fix: Re-upload the generated PDF with proper binary content.
 * The previous upload sent "[object Blob]" instead of actual PDF bytes.
 */
import { readFileSync } from "fs";
import mysql from "mysql2/promise";

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!FORGE_API_URL || !FORGE_API_KEY || !DATABASE_URL) {
  console.error("Missing env vars");
  process.exit(1);
}

// Read the locally generated PDF
const pdfBuffer = readFileSync("/home/ubuntu/NOVO_LATICINIOS_SAO_VICENTE.pdf");
console.log(`PDF file size: ${pdfBuffer.length} bytes`);

// Upload to S3 using Node.js native FormData with proper File/Blob handling
const baseUrl = FORGE_API_URL.replace(/\/+$/, "");
const fileKey = `decision-pdfs/${Date.now()}-LATICINIOS_SAO_VICENTE_DE_MINAS_v2.pdf`;
const uploadUrl = new URL("v1/storage/upload", baseUrl + "/");
uploadUrl.searchParams.set("path", fileKey);

// Use proper File constructor for FormData
const formData = new FormData();
const file = new File([pdfBuffer], fileKey.split("/").pop(), { type: "application/pdf" });
formData.append("file", file);

console.log(`Uploading to: ${uploadUrl.toString()}`);

const uploadResponse = await fetch(uploadUrl.toString(), {
  method: "POST",
  headers: { Authorization: `Bearer ${FORGE_API_KEY}` },
  body: formData,
});

if (!uploadResponse.ok) {
  const errText = await uploadResponse.text();
  console.error(`Upload failed: ${uploadResponse.status} ${errText}`);
  process.exit(1);
}

const { url: newFileUrl } = await uploadResponse.json();
console.log(`Uploaded to S3: ${newFileUrl}`);

// Verify the upload by checking content-length
const headResp = await fetch(newFileUrl, { method: "HEAD" });
console.log(`Verify - Content-Length: ${headResp.headers.get("content-length")}, Content-Type: ${headResp.headers.get("content-type")}`);

// Update database record
const connection = await mysql.createConnection(DATABASE_URL);
await connection.execute(
  "UPDATE decision_pdf_history SET file_key = ?, file_url = ? WHERE protocolo = ?",
  [fileKey, newFileUrl, "GF-20260504-1459-8390"]
);
console.log(`Updated DB record with new URL: ${newFileUrl}`);
await connection.end();
console.log("Done! PDF replaced successfully with correct binary content.");
