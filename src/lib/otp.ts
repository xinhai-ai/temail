import OTPAuth from "otpauth";

export const DEFAULT_TOTP_DIGITS = 6;
export const DEFAULT_TOTP_PERIOD = 30;
export const DEFAULT_TOTP_ALGORITHM = "SHA1";

export function normalizeOtpCode(value: string): string {
  return (value || "").replace(/[^\dA-Za-z]/g, "").toUpperCase();
}

export function createTotp(params: {
  issuer: string;
  label: string;
  secretBase32: string;
  digits?: number;
  period?: number;
  algorithm?: "SHA1" | "SHA256" | "SHA512";
}): OTPAuth.TOTP {
  const secret = OTPAuth.Secret.fromBase32(params.secretBase32);
  return new OTPAuth.TOTP({
    issuer: params.issuer,
    label: params.label,
    algorithm: params.algorithm ?? DEFAULT_TOTP_ALGORITHM,
    digits: params.digits ?? DEFAULT_TOTP_DIGITS,
    period: params.period ?? DEFAULT_TOTP_PERIOD,
    secret,
  });
}

export function generateTotpSecretBase32(): string {
  return new OTPAuth.Secret().base32;
}

export function buildOtpAuthUrl(params: {
  issuer: string;
  label: string;
  secretBase32: string;
  digits?: number;
  period?: number;
  algorithm?: "SHA1" | "SHA256" | "SHA512";
}): string {
  const totp = createTotp(params);
  return totp.toString();
}

export function verifyTotpCode(params: {
  code: string;
  issuer: string;
  label: string;
  secretBase32: string;
  digits?: number;
  period?: number;
  algorithm?: "SHA1" | "SHA256" | "SHA512";
  window?: number;
}): boolean {
  const token = normalizeOtpCode(params.code);
  if (!token) return false;

  const totp = createTotp(params);
  const delta = totp.validate({ token, window: params.window ?? 1 });
  return delta !== null;
}
