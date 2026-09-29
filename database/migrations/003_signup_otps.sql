CREATE TABLE "signup_otps" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL UNIQUE CHECK (length(btrim("email")) > 0),
  "otpHash" text NOT NULL CHECK (length(btrim("otpHash")) > 0),
  "signupData" jsonb NOT NULL CHECK (jsonb_typeof("signupData") = 'object'),
  "expiresAt" timestamptz NOT NULL,
  "lastSentAt" timestamptz NOT NULL,
  "attempts" double precision NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "signup_otps_expires_at" ON "signup_otps" ("expiresAt");
