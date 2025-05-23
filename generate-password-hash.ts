import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  try {
    const hashedPassword = await hashPassword("password");
    console.log('Hashed password:', hashedPassword);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();