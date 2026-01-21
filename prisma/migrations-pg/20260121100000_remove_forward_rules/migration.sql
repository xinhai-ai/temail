-- Remove standalone forward rules (kept workflow forwarding)
DROP TABLE IF EXISTS "forward_logs";
DROP TABLE IF EXISTS "forward_targets";
DROP TABLE IF EXISTS "forward_rules";

DROP TYPE IF EXISTS "ForwardStatus";
DROP TYPE IF EXISTS "ForwardType";

