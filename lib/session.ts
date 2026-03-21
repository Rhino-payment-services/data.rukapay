import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "exec_session";

export function getCookieName() {
  return COOKIE_NAME;
}

export async function createSessionToken(secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: "exec" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const key = new TextEncoder().encode(secret);
    await jwtVerify(token, key);
    return true;
  } catch {
    return false;
  }
}
