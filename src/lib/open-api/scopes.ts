export const OPEN_API_SCOPES = [
  "mailboxes:read",
  "mailboxes:write",
  "emails:read",
  "emails:write",
  "emails:raw",
  "emails:attachments",
  "tags:read",
  "tags:write",
  "search:read",
  "domains:read",
  "groups:read",
  "groups:write",
] as const;

export type OpenApiScope = (typeof OPEN_API_SCOPES)[number];

export const OPEN_API_SCOPES_ZOD = [...OPEN_API_SCOPES] as [OpenApiScope, ...OpenApiScope[]];

export const DEFAULT_OPEN_API_KEY_SCOPES: OpenApiScope[] = [
  "mailboxes:read",
  "emails:read",
  "emails:raw",
  "emails:attachments",
  "tags:read",
  "search:read",
  "domains:read",
  "groups:read",
];
