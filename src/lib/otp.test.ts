import assert from "node:assert/strict";
import test from "node:test";
import { createTotp, generateTotpSecretBase32, verifyTotpCode } from "@/lib/otp";
import { formatBackupCode, generateBackupCode, normalizeBackupCode } from "@/lib/backup-codes";

test("verifyTotpCode accepts current token", () => {
  const issuer = "TEmail";
  const label = "user@example.com";
  const secretBase32 = generateTotpSecretBase32();
  const totp = createTotp({ issuer, label, secretBase32 });
  const token = totp.generate();

  const ok = verifyTotpCode({ code: token, issuer, label, secretBase32 });
  assert.equal(ok, true);
});

test("backup codes normalize and format", () => {
  const code = generateBackupCode();
  const normalized = normalizeBackupCode(code);

  assert.equal(normalized.length, 10);
  assert.equal(formatBackupCode(normalized).replace(/-/g, ""), normalized);
});
