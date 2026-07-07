#!/usr/bin/env node
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MODEL_URL = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/qwen3-8b-q4_k_m.gguf";
const MODEL_DIR = path.join(process.env.HOME || process.env.USERPROFILE || "~", ".noffice", "models");
const MODEL_PATH = path.join(MODEL_DIR, "qwen3-8b-q4_k_m.gguf");
const EXPECTED_SHA256 = process.argv.includes("--verify") ? process.argv[process.argv.indexOf("--verify") + 1] : null;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bytesPerSecond) {
  return `${formatBytes(bytesPerSecond)}/s`;
}

function formatETA(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const tempPath = destPath + ".part";

    protocol.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers["content-length"] || "0", 10);
      let downloadedBytes = 0;
      let lastTime = Date.now();
      let lastBytes = 0;
      let writeStream;

      try {
        writeStream = fs.createWriteStream(tempPath);
      } catch (err) {
        reject(err);
        return;
      }

      response.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        writeStream.write(chunk);

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.5) {
          const bytesSinceLast = downloadedBytes - lastBytes;
          const speed = bytesSinceLast / elapsed;
          const percent = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : "?";
          const eta = totalBytes > 0 && speed > 0 ? (totalBytes - downloadedBytes) / speed : 0;

          process.stdout.write(
            `\r\x1b[K[${">".repeat(Math.floor(percent / 5))}${" ".repeat(20 - Math.floor(percent / 5))}] ` +
            `${percent}% | ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} | ` +
            `${formatSpeed(speed)} | ETA: ${formatETA(eta)}`
          );

          lastTime = now;
          lastBytes = downloadedBytes;
        }
      });

      response.on("end", () => {
        writeStream.end();
        process.stdout.write("\n");
      });

      writeStream.on("finish", () => {
        fs.renameSync(tempPath, destPath);
        console.log(`\nDownload complete: ${destPath}`);
        console.log(`Size: ${formatBytes(downloadedBytes)}`);
        resolve(destPath);
      });

      writeStream.on("error", (err) => {
        fs.unlink(tempPath, () => {});
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

function verifyIntegrity(filePath, expectedHash) {
  if (!expectedHash) {
    console.log("Skipping SHA256 verification (no hash provided). Use --verify <sha256> to verify.");
    return true;
  }

  console.log("Verifying file integrity...");
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => {
      const fileHash = hash.digest("hex");
      if (fileHash === expectedHash) {
        console.log(`SHA256: ${fileHash} - OK`);
        resolve(true);
      } else {
        console.error(`SHA256 mismatch!\nExpected: ${expectedHash}\nGot:      ${fileHash}`);
        resolve(false);
      }
    });
    stream.on("error", reject);
  });
}

async function main() {
  console.log("nOffice Model Downloader");
  console.log("========================");
  console.log(`Model: Qwen3 8B Q4_K_M`);
  console.log(`URL: ${MODEL_URL}`);
  console.log(`Destination: ${MODEL_PATH}\n`);

  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  if (fs.existsSync(MODEL_PATH)) {
    const stats = fs.statSync(MODEL_PATH);
    console.log(`Model already exists at ${MODEL_PATH} (${formatBytes(stats.size)})`);
    if (EXPECTED_SHA256) {
      const ok = await verifyIntegrity(MODEL_PATH, EXPECTED_SHA256);
      process.exit(ok ? 0 : 1);
    }
    process.exit(0);
  }

  try {
    await downloadFile(MODEL_URL, MODEL_PATH);
    if (EXPECTED_SHA256) {
      const ok = await verifyIntegrity(MODEL_PATH, EXPECTED_SHA256);
      process.exit(ok ? 0 : 1);
    }
  } catch (err) {
    console.error(`\nDownload failed: ${err.message}`);
    process.exit(1);
  }
}

main();
