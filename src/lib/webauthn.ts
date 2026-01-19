import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";

const AUTHENTICATOR_TRANSPORTS = [
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
] as const satisfies readonly AuthenticatorTransportFuture[];

const AUTHENTICATOR_TRANSPORT_SET = new Set<string>(AUTHENTICATOR_TRANSPORTS);

export function normalizeAuthenticatorTransports(
  value: unknown
): AuthenticatorTransportFuture[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const transports = value.filter(
    (transport): transport is AuthenticatorTransportFuture =>
      typeof transport === "string" && AUTHENTICATOR_TRANSPORT_SET.has(transport)
  );

  return transports.length ? transports : undefined;
}

export function parseAuthenticatorTransportsJson(
  json: string | null | undefined
): AuthenticatorTransportFuture[] | undefined {
  if (!json) return undefined;

  try {
    return normalizeAuthenticatorTransports(JSON.parse(json));
  } catch {
    return undefined;
  }
}

export function stringifyAuthenticatorTransports(value: unknown): string | null {
  const transports = normalizeAuthenticatorTransports(value);
  return transports ? JSON.stringify(transports) : null;
}

