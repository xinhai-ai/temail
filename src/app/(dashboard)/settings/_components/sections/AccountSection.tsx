"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { User, Info, Globe } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { useProfile } from "../../_hooks/useProfile";

type UserGroupInfo = {
  userGroup: {
    id: string;
    name: string;
    maxMailboxes: number | null;
    maxWorkflows: number | null;
    telegramEnabled: boolean;
    workflowEnabled: boolean;
    workflowForwardEmailEnabled: boolean;
    workflowForwardWebhookEnabled: boolean;
    openApiEnabled: boolean;
  } | null;
  usage: { mailboxes: number; workflows: number };
};

type LinuxDoInfo = {
  linked: boolean;
  linuxdo?: {
    id: string;
    username: string;
    name: string | null;
    trustLevel: number;
    avatarUrl: string | null;
  };
};

type AccountSectionProps = {
  profile: ReturnType<typeof useProfile>;
};

export function AccountSection({ profile }: AccountSectionProps) {
  const { data: session } = useSession();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const {
    name,
    setName,
    profileEmail,
    profileDirty,
    profileLoading,
    profileSaving,
    authSources,
    emailChangeOpen,
    setEmailChangeOpen,
    emailChangeNewEmail,
    setEmailChangeNewEmail,
    emailChangeLoading,
    handleUpdateProfile,
    handleResetProfile,
    handleRequestEmailChange,
  } = profile;

  const [userGroupInfo, setUserGroupInfo] = useState<UserGroupInfo | null>(null);
  const [userGroupLoading, setUserGroupLoading] = useState(true);
  const [linuxDoInfo, setLinuxDoInfo] = useState<LinuxDoInfo | null>(null);
  const [linuxDoLoading, setLinuxDoLoading] = useState(true);

  const formatAuthSource = (source: string) => {
    if (source === "password") return t("profile.authSources.password");
    if (source === "github") return t("profile.authSources.github");
    if (source === "linuxdo") return t("profile.authSources.linuxdo");
    return source;
  };

  useEffect(() => {
    const load = async () => {
      setUserGroupLoading(true);
      const res = await fetch("/api/users/me/usergroup");
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data === "object") {
        setUserGroupInfo(data as UserGroupInfo);
      } else {
        setUserGroupInfo(null);
      }
      setUserGroupLoading(false);
    };
    load().catch(() => setUserGroupLoading(false));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLinuxDoLoading(true);
      const res = await fetch("/api/users/me/linuxdo");
      const data = await res.json().catch(() => null);
      if (res.ok && data && typeof data === "object") {
        setLinuxDoInfo(data as LinuxDoInfo);
      } else {
        setLinuxDoInfo(null);
      }
      setLinuxDoLoading(false);
    };
    load().catch(() => setLinuxDoLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("profile.title")}
          </CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
          {profileDirty && (
            <CardAction>
              <Badge variant="outline">{t("profile.unsaved")}</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("profile.email.label")}</Label>
            <Input value={profileEmail || session?.user?.email || ""} disabled />
            <p className="text-xs text-muted-foreground">{t("profile.email.help")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailChangeOpen(true)}
                disabled={profileLoading || profileSaving}
              >
                {t("profile.email.change")}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("profile.registrationSource.label")}</Label>
            {authSources.length === 0 ? (
              <div className="text-sm text-muted-foreground">{tCommon("none")}</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {authSources.map((source) => (
                  <Badge key={source} variant="outline">
                    {formatAuthSource(source)}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("profile.registrationSource.help")}</p>
          </div>
          <div className="space-y-2">
            <Label>{t("profile.name.label")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.name.placeholder")}
              disabled={profileLoading || profileSaving}
            />
            <p className="text-xs text-muted-foreground">{t("profile.name.help")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleUpdateProfile} disabled={!profileDirty || profileLoading || profileSaving}>
              {profileSaving ? t("profile.actions.saving") : t("profile.actions.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResetProfile}
              disabled={!profileDirty || profileLoading || profileSaving}
            >
              {t("profile.actions.reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t("userGroup.title")}
          </CardTitle>
          <CardDescription>{t("userGroup.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userGroupLoading ? (
            <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{t("userGroup.group")}</div>
                <div className="text-sm text-muted-foreground">
                  {userGroupInfo?.userGroup?.name || t("userGroup.notAssigned")}
                </div>
              </div>

              <Separator />

              {(["mailboxes", "workflows"] as const).map((key) => {
                const used = userGroupInfo?.usage?.[key] ?? 0;
                const quota =
                  key === "mailboxes"
                    ? userGroupInfo?.userGroup?.maxMailboxes ?? null
                    : userGroupInfo?.userGroup?.maxWorkflows ?? null;

                const quotaLabel = quota === null ? t("userGroup.unlimited") : String(quota);
                const progress =
                  quota === null ? 0 : quota <= 0 ? (used > 0 ? 100 : 0) : Math.min(100, (used / quota) * 100);

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">
                        {key === "mailboxes" ? t("userGroup.mailboxes") : t("userGroup.workflows")}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {t("userGroup.used")}: {used} · {t("userGroup.quota")}: {quotaLabel}
                      </div>
                    </div>
                    {quota === null ? null : <Progress value={progress} />}
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("linuxdo.title")}
          </CardTitle>
          <CardDescription>{t("linuxdo.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {linuxDoLoading ? (
            <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
          ) : linuxDoInfo?.linked && linuxDoInfo.linuxdo ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarImage
                    src={linuxDoInfo.linuxdo.avatarUrl || undefined}
                    alt={linuxDoInfo.linuxdo.username}
                  />
                  <AvatarFallback>
                    {(linuxDoInfo.linuxdo.username || "LD").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="text-sm font-medium">{linuxDoInfo.linuxdo.username}</div>
                  <div className="text-xs text-muted-foreground">{linuxDoInfo.linuxdo.name || ""}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">{t("linuxdo.fields.id")}</div>
                  <div className="font-mono text-xs">{linuxDoInfo.linuxdo.id}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">{t("linuxdo.fields.username")}</div>
                  <div className="font-mono text-xs">{linuxDoInfo.linuxdo.username}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">{t("linuxdo.fields.name")}</div>
                  <div className="text-xs">{linuxDoInfo.linuxdo.name || tCommon("none")}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-muted-foreground">{t("linuxdo.fields.trustLevel")}</div>
                  <div className="font-mono text-xs">{linuxDoInfo.linuxdo.trustLevel}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">{t("linuxdo.notLinked")}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={emailChangeOpen} onOpenChange={setEmailChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.email.dialog.title")}</DialogTitle>
            <DialogDescription>{t("profile.email.dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="email-change-new-email">{t("profile.email.dialog.newEmail.label")}</Label>
            <Input
              id="email-change-new-email"
              type="email"
              placeholder={t("profile.email.dialog.newEmail.placeholder")}
              value={emailChangeNewEmail}
              onChange={(e) => setEmailChangeNewEmail(e.target.value)}
              disabled={emailChangeLoading}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmailChangeOpen(false)}
              disabled={emailChangeLoading}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={handleRequestEmailChange} disabled={emailChangeLoading}>
              {emailChangeLoading ? t("profile.email.dialog.sending") : t("profile.email.dialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
