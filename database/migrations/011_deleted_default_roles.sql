-- Keep deleted default roles from being recreated on API restart.
CREATE TABLE public.deleted_default_roles (
  name text PRIMARY KEY,
  "deletedAt" timestamptz NOT NULL DEFAULT now()
);
