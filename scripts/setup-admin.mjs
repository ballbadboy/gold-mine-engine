import { randomBytes, scryptSync } from "node:crypto";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { assertNoOwnerCredentials, renderOwnerEnv } from "./owner-env.mjs";

const filename = ".env.local";
let existing = "";
try {
  existing = await readFile(filename, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
assertNoOwnerCredentials(existing);
if (!process.stdin.isTTY)
  throw new Error("Run this command in an interactive terminal.");
process.stdout.write("New owner password (12+ characters, hidden): ");
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
let password = "";
await new Promise((resolve, reject) => {
  process.stdin.on("data", function input(chunk) {
    for (const character of chunk) {
      if (character === "\u0003") {
        process.stdin.removeListener("data", input);
        reject(new Error("Cancelled"));
        return;
      }
      if (character === "\r" || character === "\n") {
        process.stdin.removeListener("data", input);
        resolve();
        return;
      }
      if (character === "\u007f") password = password.slice(0, -1);
      else if (character >= " " && password.length < 256) password += character;
    }
  });
}).finally(() => {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write("\n");
});
if (password.length < 12)
  throw new Error(
    "Password must be at least 12 characters. Nothing was written.",
  );
const salt = randomBytes(16).toString("hex");
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const values = {
  ADMIN_PASSWORD_HASH: hash,
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
};
try {
  existing = await readFile(filename, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const output = renderOwnerEnv(existing, values);
const temporary = `${filename}.${randomBytes(8).toString("hex")}.tmp`;
try {
  await writeFile(temporary, output, { mode: 0o600, flag: "wx" });
  await rename(temporary, filename);
} finally {
  await rm(temporary, { force: true });
}
console.log(
  "Owner credentials saved to .env.local. Restart the app. The password was not saved.",
);
