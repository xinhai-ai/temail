"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { usePassword } from "../../_hooks/usePassword";
import type { useOtp } from "../../_hooks/useOtp";
import type { usePasskeys } from "../../_hooks/usePasskeys";

type SecuritySectionProps = {
  password: ReturnType<typeof usePassword>;
  otp: ReturnType<typeof useOtp>;
  passkeys: ReturnType<typeof usePasskeys>;
};

export function SecuritySection({ password, otp, passkeys }: SecuritySectionProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tAuthErrors = useTranslations("auth.errors");

  const {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
    passwordMismatch,
    passwordTooShort,
    canChangePassword,
    handleChangePassword,
  } = password;

  const {
    otpAvailable,
    otpEnabled,
    otpLoading,
    otpWorking,
    otpSetup,
    otpConfirmCode,
    setOtpConfirmCode,
    otpBackupCodes,
    otpDisablePassword,
    setOtpDisablePassword,
    handleOtpSetup,
    handleOtpConfirm,
    handleOtpDisable,
    cancelOtpSetup,
  } = otp;

  const { passkeysAvailable, passkeysLoading, passkeysWorking, passkeys: passkeysList, handleAddPasskey, handleRemovePasskey } =
    passkeys;

  return (
    <div className="space-y-6">
      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("password.title")}
          </CardTitle>
          <CardDescription>{t("password.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("password.current")}</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={changingPassword}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("password.new")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changingPassword}
              />
              {passwordTooShort && <p className="text-xs text-destructive">{tAuthErrors("passwordTooShort")}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t("password.confirm")}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={changingPassword}
              />
              {passwordMismatch && <p className="text-xs text-destructive">{tAuthErrors("passwordsDoNotMatch")}</p>}
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={!canChangePassword}>
            {changingPassword ? t("password.actions.changing") : t("password.actions.change")}
          </Button>
        </CardContent>
      </Card>

      {/* OTP Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("otp.title")}
          </CardTitle>
          <CardDescription>{t("otp.description")}</CardDescription>
          {otpLoading ? (
            <CardAction>
              <Badge variant="outline">{t("otp.status.loading")}</Badge>
            </CardAction>
          ) : !otpAvailable ? (
            <CardAction>
              <Badge variant="secondary">{t("otp.status.disabledByAdmin")}</Badge>
            </CardAction>
          ) : otpEnabled ? (
            <CardAction>
              <Badge>{t("otp.status.enabled")}</Badge>
            </CardAction>
          ) : (
            <CardAction>
              <Badge variant="outline">{t("otp.status.notEnabled")}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {otpLoading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : !otpAvailable ? (
            <p className="text-sm text-muted-foreground">{t("otp.content.disabledByAdmin")}</p>
          ) : otpEnabled ? (
            <>
              <p className="text-sm text-muted-foreground">{t("otp.content.enabled")}</p>
              <div className="space-y-2">
                <Label>{t("otp.content.disableLabel")}</Label>
                <Input
                  type="password"
                  placeholder={t("otp.content.disablePlaceholder")}
                  value={otpDisablePassword}
                  onChange={(e) => setOtpDisablePassword(e.target.value)}
                  disabled={otpWorking}
                />
                <Button variant="destructive" onClick={handleOtpDisable} disabled={otpWorking}>
                  {otpWorking ? t("otp.content.disabling") : t("otp.content.disable")}
                </Button>
              </div>
            </>
          ) : otpSetup ? (
            <>
              <p className="text-sm text-muted-foreground">{t("otp.content.setupHelp")}</p>
              {otpSetup.qrDataUrl ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={otpSetup.qrDataUrl} alt={t("otp.content.qrAlt")} className="rounded-md border" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("otp.content.qrFailed")}</p>
              )}
              <div className="space-y-2">
                <Label>{t("otp.content.secret")}</Label>
                <Input value={otpSetup.secret} readOnly className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>{t("otp.content.confirmCode")}</Label>
                <Input
                  inputMode="numeric"
                  placeholder={t("otp.content.codePlaceholder")}
                  value={otpConfirmCode}
                  onChange={(e) => setOtpConfirmCode(e.target.value)}
                  disabled={otpWorking}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleOtpConfirm} disabled={otpWorking}>
                    {otpWorking ? t("otp.content.enabling") : t("otp.content.enable")}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelOtpSetup} disabled={otpWorking}>
                    {tCommon("cancel")}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t("otp.content.setupDescription")}</p>
              <Button onClick={handleOtpSetup} disabled={otpWorking}>
                {otpWorking ? t("otp.content.settingUp") : t("otp.content.setup")}
              </Button>
            </>
          )}

          {otpBackupCodes && otpBackupCodes.length > 0 && (
            <>
              <Separator />
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">{t("otp.backupCodes.title")}</p>
                <p className="text-xs text-muted-foreground">{t("otp.backupCodes.help")}</p>
                <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap">
                  {otpBackupCodes.join("\n")}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Passkeys Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t("passkeys.title")}
          </CardTitle>
          <CardDescription>{t("passkeys.description")}</CardDescription>
          {passkeysLoading ? (
            <CardAction>
              <Badge variant="outline">{t("passkeys.status.loading")}</Badge>
            </CardAction>
          ) : !passkeysAvailable ? (
            <CardAction>
              <Badge variant="secondary">{t("passkeys.status.disabled")}</Badge>
            </CardAction>
          ) : (
            <CardAction>
              <Badge variant="outline">{passkeysList.length}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {passkeysLoading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : (
            <>
              {!passkeysAvailable && (
                <p className="text-sm text-muted-foreground">{t("passkeys.disabledByAdmin")}</p>
              )}
              <Button onClick={handleAddPasskey} disabled={passkeysWorking || !passkeysAvailable}>
                {passkeysWorking ? t("passkeys.actions.working") : t("passkeys.actions.add")}
              </Button>
              {passkeysList.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("passkeys.empty")}</p>
              ) : (
                <div className="space-y-2">
                  {passkeysList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.deviceType ? t("passkeys.device", { deviceType: p.deviceType }) : t("passkeys.passkey")}
                          {p.backedUp ? ` · ${t("passkeys.synced")}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("passkeys.meta.added", { date: new Date(p.createdAt).toLocaleString() })}
                          {p.lastUsedAt
                            ? ` · ${t("passkeys.meta.lastUsed", { date: new Date(p.lastUsedAt).toLocaleString() })}`
                            : ""}
                        </p>
                      </div>
                      <Button variant="destructive" onClick={() => handleRemovePasskey(p.id)} disabled={passkeysWorking}>
                        {t("passkeys.actions.remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
