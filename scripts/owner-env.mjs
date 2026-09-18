import { parseEnv } from "node:util";
const names = ["ADMIN_PASSWORD_HASH", "ADMIN_SESSION_SECRET"];
export function assertNoOwnerCredentials(source) {
  const values = parseEnv(source);
  if (names.some((name) => values[name]))
    throw new Error(
      "Owner credentials already exist. Rotate them deliberately.",
    );
}
export function renderOwnerEnv(source, values) {
  assertNoOwnerCredentials(source);
  const retained = source
    .split("\n")
    .filter(
      (line) =>
        !/^\s*(?:export\s+)?(?:ADMIN_PASSWORD_HASH|ADMIN_SESSION_SECRET)\s*=/.test(
          line,
        ),
    )
    .join("\n");
  return (
    retained +
    "\n" +
    names.map((name) => `${name}="${values[name]}"`).join("\n") +
    "\n"
  );
}
