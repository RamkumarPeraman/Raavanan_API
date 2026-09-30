CREATE TABLE "password_reset_otps" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL UNIQUE CHECK (length(btrim("email")) > 0),
  "otpHash" text NOT NULL CHECK (length(btrim("otpHash")) > 0),
  "expiresAt" timestamptz NOT NULL,
  "lastSentAt" timestamptz NOT NULL,
  "attempts" double precision NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "verifiedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "password_reset_otps_expires_at" ON "password_reset_otps" ("expiresAt");
