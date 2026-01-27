import assert from "node:assert/strict";
import test from "node:test";
import {
  generateOpenApiKeyToken,
  hashOpenApiKeyToken,
  isOpenApiKeyToken,
  parseOpenApiKeyToken,
  parseOpenApiScopes,
  serializeOpenApiScopes,
} from "@/lib/open-api/api-keys";

test("open api key tokens parse and hash", () => {
  process.env.OPEN_API_KEY_PEPPER = "test-pepper";

  const generated = generateOpenApiKeyToken();
  assert.equal(isOpenApiKeyToken(generated.token), true);

  const parsed = parseOpenApiKeyToken(generated.token);
  assert.ok(parsed);
  assert.equal(parsed.keyPrefix, generated.keyPrefix);

  assert.equal(hashOpenApiKeyToken(parsed.token), generated.keyHash);
});

test("open api scopes serialize/parse", () => {
  const json = serializeOpenApiScopes(["emails:read", "mailboxes:read"]);
  const scopes = parseOpenApiScopes(json);
  assert.deepEqual(scopes, ["emails:read", "mailboxes:read"]);
});
