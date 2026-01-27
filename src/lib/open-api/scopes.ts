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
] as const;

export type OpenApiScope = (typeof OPEN_API_SCOPES)[number];

export const DEFAULT_OPEN_API_KEY_SCOPES: OpenApiScope[] = [
  "mailboxes:read",
  "emails:read",
  "tags:read",
  "search:read",
];
