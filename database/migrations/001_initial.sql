-- Initial PostgreSQL schema. Applied once by the versioned migration runner.

CREATE TABLE "roles" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE CHECK (length(btrim("name"))>0),
  "displayName" text NOT NULL CHECK (length(btrim("displayName"))>0),
  "description" text,
  "permissions" jsonb CHECK (jsonb_typeof("permissions")='array'),
  "isSystem" boolean,
  "status" text CHECK ("status" IN ('active', 'inactive')),
  "color" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "users" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length(btrim("name"))>0),
  "email" text NOT NULL UNIQUE CHECK (length(btrim("email"))>0),
  "phone" text,
  "passwordHash" text NOT NULL CHECK (length(btrim("passwordHash"))>0),
  "role" text REFERENCES roles(name) ON UPDATE CASCADE ON DELETE RESTRICT,
  "status" text CHECK ("status" IN ('active', 'inactive')),
  "department" text,
  "location" text,
  "profileImage" text,
  "bio" text,
  "dateOfBirth" text,
  "gender" text,
  "bloodGroup" text,
  "address" jsonb CHECK (jsonb_typeof("address")='object'),
  "occupation" text,
  "organization" text,
  "joinDate" text,
  "membershipId" text UNIQUE,
  "membershipType" text,
  "socialLinks" jsonb CHECK (jsonb_typeof("socialLinks")='object'),
  "interests" jsonb CHECK (jsonb_typeof("interests")='array'),
  "skills" jsonb CHECK (jsonb_typeof("skills")='array'),
  "preferences" jsonb CHECK (jsonb_typeof("preferences")='object'),
  "privacy" jsonb CHECK (jsonb_typeof("privacy")='object'),
  "stats" jsonb CHECK (jsonb_typeof("stats")='object'),
  "lastActive" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "volunteers" (
  "id" text PRIMARY KEY,
  "fullName" text NOT NULL CHECK (length(btrim("fullName"))>0),
  "email" text NOT NULL UNIQUE CHECK (length(btrim("email"))>0),
  "phone" text NOT NULL CHECK (length(btrim("phone"))>0),
  "address" text,
  "gender" text,
  "city" text,
  "state" text,
  "pincode" text,
  "dateOfBirth" text,
  "education" text,
  "educationOther" text,
  "institution" text,
  "occupation" text,
  "occupationOther" text,
  "skills" jsonb CHECK (jsonb_typeof("skills")='array'),
  "skillsOther" text,
  "interests" jsonb CHECK (jsonb_typeof("interests")='array'),
  "capacity" jsonb CHECK (jsonb_typeof("capacity")='array'),
  "capacityOther" text,
  "availability" jsonb,
  "hoursPerWeek" text,
  "experience" text,
  "motivation" text,
  "previousVolunteer" text,
  "emergencyContact" jsonb CHECK (jsonb_typeof("emergencyContact")='object'),
  "hearAbout" text,
  "hearAboutOther" text,
  "selectedOpportunityId" text,
  "selectedOpportunityTitle" text,
  "corePurpose" text,
  "newLaw" text,
  "viewOnSociety" text,
  "leadershipAction" text,
  "dailyHabit" text,
  "agreeConduct" boolean,
  "agreeDeclaration" boolean,
  "status" text CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "passwordHash" text NOT NULL CHECK (length(btrim("passwordHash"))>0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "projects" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "description" text NOT NULL CHECK (length(btrim("description"))>0),
  "longDescription" text,
  "image" text,
  "gallery" jsonb CHECK (jsonb_typeof("gallery")='array'),
  "status" text CHECK ("status" IN ('ongoing', 'completed', 'planned')),
  "category" text NOT NULL CHECK (length(btrim("category"))>0),
  "progress" double precision CHECK ("progress">=0) CHECK ("progress"<=100),
  "goal" numeric(18,2) CHECK ("goal">=0),
  "raised" numeric(18,2) CHECK ("raised">=0),
  "location" text,
  "statesCovered" jsonb CHECK (jsonb_typeof("statesCovered")='array'),
  "startDate" timestamptz,
  "endDate" timestamptz,
  "impact" jsonb CHECK (jsonb_typeof("impact")='object'),
  "livesImpacted" double precision CHECK ("livesImpacted">=0),
  "volunteersEngaged" double precision CHECK ("volunteersEngaged">=0),
  "objectives" jsonb CHECK (jsonb_typeof("objectives")='array'),
  "achievements" jsonb CHECK (jsonb_typeof("achievements")='array'),
  "partners" jsonb CHECK (jsonb_typeof("partners")='array'),
  "funding" jsonb CHECK (jsonb_typeof("funding")='array'),
  "reportUrl" text,
  "featured" boolean,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "events" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "description" text NOT NULL CHECK (length(btrim("description"))>0),
  "type" text NOT NULL CHECK (length(btrim("type"))>0),
  "category" text,
  "date" timestamptz NOT NULL,
  "time" text NOT NULL CHECK (length(btrim("time"))>0),
  "location" text NOT NULL CHECK (length(btrim("location"))>0),
  "capacity" double precision CHECK ("capacity">=0),
  "registered" double precision CHECK ("registered">=0),
  "price" numeric(18,2) CHECK ("price">=0),
  "speakers" jsonb CHECK (jsonb_typeof("speakers")='array'),
  "image" text,
  "attendees" jsonb CHECK (jsonb_typeof("attendees")='array'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "blogs" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "excerpt" text NOT NULL CHECK (length(btrim("excerpt"))>0),
  "content" text NOT NULL CHECK (length(btrim("content"))>0),
  "author" text NOT NULL CHECK (length(btrim("author"))>0),
  "date" timestamptz NOT NULL,
  "category" text NOT NULL CHECK (length(btrim("category"))>0),
  "image" text,
  "readTime" double precision CHECK ("readTime">=1),
  "tags" jsonb CHECK (jsonb_typeof("tags")='array'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "reports" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "type" text NOT NULL CHECK ("type" IN ('annual', 'quarterly', 'impact', 'financial', 'project', 'field_visit', 'sustainability', 'publication')) CHECK (length(btrim("type"))>0),
  "category" text,
  "year" text,
  "period" text,
  "publishedDate" timestamptz NOT NULL,
  "description" text NOT NULL CHECK (length(btrim("description"))>0),
  "summary" text,
  "fileSize" text,
  "pages" double precision CHECK ("pages">=0),
  "downloads" double precision CHECK ("downloads">=0),
  "views" double precision CHECK ("views">=0),
  "featured" boolean,
  "thumbnail" text,
  "url" text,
  "metrics" jsonb CHECK (jsonb_typeof("metrics")='object'),
  "highlights" jsonb CHECK (jsonb_typeof("highlights")='array'),
  "projects" jsonb CHECK (jsonb_typeof("projects")='array'),
  "testimonials" jsonb CHECK (jsonb_typeof("testimonials")='array'),
  "financial" jsonb CHECK (jsonb_typeof("financial")='object'),
  "gallery" jsonb CHECK (jsonb_typeof("gallery")='array'),
  "status" text CHECK ("status" IN ('draft', 'published', 'archived')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "volunteer_opportunities" (
  "id" text PRIMARY KEY,
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "category" text NOT NULL CHECK (length(btrim("category"))>0),
  "location" text NOT NULL CHECK (length(btrim("location"))>0),
  "commitment" text NOT NULL CHECK (length(btrim("commitment"))>0),
  "spots" double precision CHECK ("spots">=1),
  "description" text NOT NULL CHECK (length(btrim("description"))>0),
  "requirements" jsonb CHECK (jsonb_typeof("requirements")='array'),
  "image" text,
  "status" text CHECK ("status" IN ('active', 'inactive')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "donations" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length(btrim("name"))>0),
  "email" text NOT NULL CHECK (length(btrim("email"))>0),
  "phone" text NOT NULL CHECK (length(btrim("phone"))>0),
  "amount" numeric(18,2) NOT NULL CHECK ("amount">=1),
  "type" text CHECK ("type" IN ('one-time', 'monthly')),
  "project" text,
  "paymentMethod" text,
  "paymentStatus" text CHECK ("paymentStatus" IN ('pending', 'accepted', 'rejected', 'completed', 'failed')),
  "address" text,
  "city" text,
  "state" text,
  "pincode" text,
  "pan" text,
  "anonymous" boolean,
  "paymentId" text,
  "transactionId" text,
  "paymentScreenshot" text,
  "message" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "services" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length(btrim("name"))>0),
  "email" text NOT NULL CHECK (length(btrim("email"))>0),
  "phone" text NOT NULL CHECK (length(btrim("phone"))>0),
  "category" text CHECK ("category" IN ('general', 'education', 'healthcare', 'food', 'shelter', 'other')),
  "message" text NOT NULL CHECK (length(btrim("message"))>0),
  "status" text CHECK ("status" IN ('pending', 'processing', 'completed', 'rejected')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "admin_settings" (
  "id" text PRIMARY KEY,
  "key" text UNIQUE,
  "donationQrImage" text,
  "bankDetails" jsonb CHECK (jsonb_typeof("bankDetails")='object'),
  "heroNewsCarousel" jsonb CHECK (jsonb_typeof("heroNewsCarousel")='array'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "conversations" (
  "id" text PRIMARY KEY,
  "type" text CHECK ("type" IN ('direct', 'group')),
  "name" text,
  "participants" jsonb NOT NULL CHECK (jsonb_typeof("participants")='array') CHECK (jsonb_array_length("participants")>=2),
  "createdBy" text NOT NULL,
  "directKey" text UNIQUE,
  "lastMessage" jsonb CHECK (jsonb_typeof("lastMessage")='object'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "messages" (
  "id" text PRIMARY KEY,
  "conversation" text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  "sender" text NOT NULL,
  "content" text NOT NULL CHECK (length("content")<=3000) CHECK (length(btrim("content"))>0),
  "readBy" jsonb CHECK (jsonb_typeof("readBy")='array'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "notifications" (
  "id" text PRIMARY KEY,
  "user" text NOT NULL,
  "type" text CHECK ("type" IN ('direct_message', 'group_message')),
  "title" text NOT NULL CHECK (length(btrim("title"))>0),
  "message" text NOT NULL CHECK (length(btrim("message"))>0),
  "conversation" text REFERENCES conversations(id) ON DELETE CASCADE,
  "relatedMessage" text REFERENCES messages(id) ON DELETE CASCADE,
  "sender" text,
  "isRead" boolean,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_lookup_idx ON users (role);
CREATE INDEX messages_lookup_idx ON messages (conversation, "createdAt");
CREATE INDEX notifications_lookup_idx ON notifications ("user", "isRead", "createdAt");
CREATE INDEX donations_lookup_idx ON donations ("createdAt");
CREATE INDEX events_lookup_idx ON events (date);
CREATE INDEX reports_lookup_idx ON reports ("publishedDate");
CREATE INDEX conversations_participants_idx ON conversations USING gin (participants);
CREATE INDEX events_attendees_idx ON events USING gin (attendees);
CREATE UNIQUE INDEX users_email_case_idx ON users (lower(email));
CREATE UNIQUE INDEX volunteers_email_case_idx ON volunteers (lower(email));
CREATE TABLE legacy_documents (collection text NOT NULL, source_id text NOT NULL, document jsonb NOT NULL, PRIMARY KEY (collection, source_id));
