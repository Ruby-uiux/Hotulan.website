#!/usr/bin/env node
/**
 * Generates the admin login values for .env.local.
 *
 *   npm run admin:hash
 *
 * Prompts for the password (so it doesn't land in shell history), then prints
 * ADMIN_PASSWORD_HASH and a fresh SESSION_SECRET. The format must stay in sync
 * with lib/auth/password.ts.
 */
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";

const PARAMS = { N: 16384, r: 8, p: 1 };

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Mask typed characters with '*'.
  rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : "*".repeat(s.length));
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

const password = process.argv[2] ?? (await ask("Шинэ нууц үг: "));
if (password.length < 10) {
  console.error("Нууц үг дор хаяж 10 тэмдэгт байх ёстой.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(password, salt, 64, PARAMS, (err, k) => (err ? reject(err) : resolve(k))),
);

console.log("\n# .env.local файлд хуулна уу:");
console.log(`ADMIN_PASSWORD_HASH=${["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join(":")}`);
console.log(`SESSION_SECRET=${randomBytes(32).toString("base64url")}`);
