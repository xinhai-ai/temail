"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { DEFAULT_OPEN_API_KEY_SCOPES } from "@/lib/open-api/scopes";
import { getApiErrorMessage, type Translator } from "@/lib/policy-client";

type ApiKeyInfo = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  usageCount: number;
  lastUsedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type UseApiKeysReturn = {
  apiKeysLoading: boolean;
  apiKeysWorkingId: string | null;
  apiKeys: ApiKeyInfo[];
  showCreateApiKeyDialog: boolean;
  setShowCreateApiKeyDialog: (show: boolean) => void;
  apiKeyName: string;
  setApiKeyName: (name: string) => void;
  apiKeyScopes: string[];
  setApiKeyScopeChecked: (scope: string, checked: boolean) => void;
  creatingApiKey: boolean;
  createdApiToken: string | null;
  editingApiKey: ApiKeyInfo | null;
  editingApiKeyScopes: string[];
  setEditingApiKeyScopeChecked: (scope: string, checked: boolean) => void;
  handleOpenCreateDialog: () => void;
  handleCloseCreateDialog: () => void;
  handleCreateApiKey: () => Promise<void>;
  handleCopyApiToken: () => Promise<void>;
  handleSetApiKeyDisabled: (keyId: string, disabled: boolean) => Promise<void>;
  handleDeleteApiKey: (keyId: string) => Promise<void>;
  handleStartEditApiKeyScopes: (key: ApiKeyInfo) => void;
  handleCancelEditApiKeyScopes: () => void;
  handleSaveApiKeyScopes: () => Promise<void>;
};

export function useApiKeys(): UseApiKeysReturn {
  const t = useTranslations("settings");
  const tPolicy = useTranslations("policy") as unknown as Translator;
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeysWorkingId, setApiKeysWorkingId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [showCreateApiKeyDialog, setShowCreateApiKeyDialog] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>(DEFAULT_OPEN_API_KEY_SCOPES);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState<ApiKeyInfo | null>(null);
  const [editingApiKeyScopes, setEditingApiKeyScopes] = useState<string[]>([]);

  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    const res = await fetch("/api/open-api/keys");
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setApiKeys(Array.isArray(data?.keys) ? (data.keys as ApiKeyInfo[]) : []);
    } else {
      toast.error(getApiErrorMessage(tPolicy, data, t("toast.saveFailed")));
    }
    setApiKeysLoading(false);
  }, [t, tPolicy]);

  useEffect(() => {
    fetchApiKeys().catch(() => setApiKeysLoading(false));
  }, [fetchApiKeys]);

  const setApiKeyScopeChecked = useCallback((scope: string, checked: boolean) => {
    setApiKeyScopes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return Array.from(next).sort();
    });
  }, []);

  const setEditingApiKeyScopeChecked = useCallback((scope: string, checked: boolean) => {
    setEditingApiKeyScopes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return Array.from(next).sort();
    });
  }, []);

  const handleOpenCreateDialog = useCallback(() => {
    setApiKeyName("");
    setApiKeyScopes([...DEFAULT_OPEN_API_KEY_SCOPES]);
    setCreatedApiToken(null);
    setShowCreateApiKeyDialog(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    setShowCreateApiKeyDialog(false);
    setCreatedApiToken(null);
    setApiKeyName("");
    setApiKeyScopes([...DEFAULT_OPEN_API_KEY_SCOPES]);
  }, []);

  const handleCreateApiKey = useCallback(async () => {
    if (apiKeyScopes.length === 0) {
      toast.error(t("toast.selectAtLeastOneScope"));
      return;
    }

    setCreatingApiKey(true);
    try {
      const body: { name?: string; scopes: string[] } = { scopes: apiKeyScopes };
      const trimmedName = apiKeyName.trim();
      if (trimmedName) body.name = trimmedName;

      const res = await fetch("/api/open-api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getApiErrorMessage(tPolicy, data, t("toast.apiKeyCreateFailed")));
        return;
      }

      setCreatedApiToken(typeof data?.token === "string" ? data.token : null);
      toast.success(t("toast.apiKeyCreated"));
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyCreateFailed"));
    } finally {
      setCreatingApiKey(false);
    }
  }, [apiKeyName, apiKeyScopes, fetchApiKeys, t, tPolicy]);

  const handleCopyApiToken = useCallback(async () => {
    if (!createdApiToken) return;
    try {
      await navigator.clipboard.writeText(createdApiToken);
      toast.success(t("toast.apiKeyCopied"));
    } catch {
      toast.error(t("toast.saveFailed"));
    }
  }, [createdApiToken, t]);

  const handleSetApiKeyDisabled = useCallback(
    async (keyId: string, disabled: boolean) => {
      setApiKeysWorkingId(keyId);
      try {
        const res = await fetch(`/api/open-api/keys/${keyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ disabled }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(getApiErrorMessage(tPolicy, data, t("toast.apiKeyUpdateFailed")));
          return;
        }
        toast.success(t("toast.apiKeyUpdated"));
        fetchApiKeys().catch(() => null);
      } catch {
        toast.error(t("toast.apiKeyUpdateFailed"));
      } finally {
        setApiKeysWorkingId(null);
      }
    },
    [fetchApiKeys, t, tPolicy]
  );

  const handleDeleteApiKey = useCallback(
    async (keyId: string) => {
      if (!confirm(t("apiKeys.confirmDelete"))) return;

      setApiKeysWorkingId(keyId);
      try {
        const res = await fetch(`/api/open-api/keys/${keyId}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(getApiErrorMessage(tPolicy, data, t("toast.apiKeyDeleteFailed")));
          return;
        }
        toast.success(t("toast.apiKeyDeleted"));
        fetchApiKeys().catch(() => null);
      } catch {
        toast.error(t("toast.apiKeyDeleteFailed"));
      } finally {
        setApiKeysWorkingId(null);
      }
    },
    [fetchApiKeys, t, tPolicy]
  );

  const handleStartEditApiKeyScopes = useCallback((key: ApiKeyInfo) => {
    setEditingApiKey(key);
    setEditingApiKeyScopes([...key.scopes]);
  }, []);

  const handleCancelEditApiKeyScopes = useCallback(() => {
    setEditingApiKey(null);
    setEditingApiKeyScopes([]);
  }, []);

  const handleSaveApiKeyScopes = useCallback(async () => {
    if (!editingApiKey) return;
    if (editingApiKeyScopes.length === 0) {
      toast.error(t("toast.selectAtLeastOneScope"));
      return;
    }

    setApiKeysWorkingId(editingApiKey.id);
    try {
      const res = await fetch(`/api/open-api/keys/${editingApiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: editingApiKeyScopes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(getApiErrorMessage(tPolicy, data, t("toast.apiKeyUpdateFailed")));
        return;
      }
      toast.success(t("toast.apiKeyUpdated"));
      setEditingApiKey(null);
      setEditingApiKeyScopes([]);
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyUpdateFailed"));
    } finally {
      setApiKeysWorkingId(null);
    }
  }, [editingApiKey, editingApiKeyScopes, fetchApiKeys, t, tPolicy]);

  return {
    apiKeysLoading,
    apiKeysWorkingId,
    apiKeys,
    showCreateApiKeyDialog,
    setShowCreateApiKeyDialog,
    apiKeyName,
    setApiKeyName,
    apiKeyScopes,
    setApiKeyScopeChecked,
    creatingApiKey,
    createdApiToken,
    editingApiKey,
    editingApiKeyScopes,
    setEditingApiKeyScopeChecked,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateApiKey,
    handleCopyApiToken,
    handleSetApiKeyDisabled,
    handleDeleteApiKey,
    handleStartEditApiKeyScopes,
    handleCancelEditApiKeyScopes,
    handleSaveApiKeyScopes,
  };
}
