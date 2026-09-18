import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE = "gm_owner_session";
export const SESSION_SECONDS = 8 * 60 * 60;
const secret = () => process.env.ADMIN_SESSION_SECRET ?? "";
export const authConfigured = () =>
  secret().length >= 32 &&
  (process.env.ADMIN_PASSWORD_HASH ?? "").startsWith("scrypt:");
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  if (password.length < 12)
    throw new Error("Password must be at least 12 characters");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string) {
  if (!authConfigured() || password.length > 256) return false;
  const [, salt, digest] = (process.env.ADMIN_PASSWORD_HASH ?? "").split(":");
  if (!salt || !digest) return false;
  return equal(scryptSync(password, salt, 64).toString("hex"), digest);
}
export function createSession(now = Date.now()) {
  if (!authConfigured())
    throw new Error("Owner authentication is not configured");
  const payload = Buffer.from(
    JSON.stringify({
      role: "owner",
      expires: now + SESSION_SECONDS * 1000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function validSession(value: string | undefined, now = Date.now()) {
  if (!authConfigured() || !value || value.length > 1000) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  if (
    !equal(
      signature,
      createHmac("sha256", secret()).update(payload).digest("base64url"),
    )
  )
    return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      decoded.role === "owner" &&
      Number.isFinite(decoded.expires) &&
      decoded.expires > now &&
      decoded.expires <= now + SESSION_SECONDS * 1000
    );
  } catch {
    return false;
  }
}
export function sessionFromRequest(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_ORIGIN;
  try {
    const url = new URL(request.url);
    const expected = configured
      ? new URL(configured).origin
      : `${url.protocol}//${request.headers.get("host") || url.host}`;
    return !!origin && new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
export function validWebhook(
  body: string,
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
) {
  const key = process.env.MARKETING_WEBHOOK_SECRET ?? "";
  if (
    key.length < 32 ||
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    !signature
  )
    return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 300_000) return false;
  const expected = createHmac("sha256", key)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return equal(signature, `sha256=${expected}`);
}
