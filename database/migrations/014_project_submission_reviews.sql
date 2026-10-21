ALTER TABLE public.project_submissions
  ADD COLUMN "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  ADD COLUMN "reviewedBy" text REFERENCES public.users("id") ON DELETE SET NULL,
  ADD COLUMN "reviewedAt" timestamptz;

CREATE INDEX project_submissions_status_idx ON public.project_submissions ("status");

UPDATE public.raavanan_validation_schemas
SET fields = fields || '{"status":{"type":"string","required":true,"enum":["pending","approved","rejected"],"default":"pending"},"reviewedBy":{"type":"id"},"reviewedAt":{"type":"date"}}'::jsonb
WHERE table_name = 'project_submissions';
