import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "ch_checkout_rate";
const REQUEST_HEADER = "x-ch-checkout-rate-token";
const TOKEN_PATTERN = /^([a-f0-9]{64})\.([a-f0-9]{64})$/;

function sign(nonce: string, secret: string): string {
  return createHmac("sha256", secret).update(`ch-checkout-rate-v1:${nonce}`).digest("hex");
}

function trustedToken(value: string | undefined, secret: string): string | null {
  const match = value?.match(TOKEN_PATTERN);
  if (!match) return null;
  const supplied = Buffer.from(match[2], "hex");
  const expected = Buffer.from(sign(match[1], secret), "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? value! : null;
}

export function proxy(request: NextRequest) {
  const secret = process.env.CH_AUTH_BRIDGE_SECRET ?? "";
  if (secret.length < 32) return NextResponse.next();

  const token = trustedToken(request.cookies.get(COOKIE_NAME)?.value, secret) ??
    (() => {
      const nonce = randomBytes(32).toString("hex");
      return `${nonce}.${sign(nonce, secret)}`;
    })();

  // Always overwrite a client-supplied header. The action/service layer reads
  // this proxy-controlled value and forwards it only over the auth bridge.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_HEADER, token);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: [
    "/",
    "/category/:path*",
    "/collections",
    "/collections/:path*",
    "/free-downloads",
    "/new-arrivals",
    "/popular",
    "/product/:path*",
    "/checkout/:path*",
  ],
};
