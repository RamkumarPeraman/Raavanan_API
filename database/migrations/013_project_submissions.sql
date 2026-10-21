CREATE TABLE public.project_submissions (
  "id" text PRIMARY KEY,
  "kind" text NOT NULL CHECK ("kind" IN ('proposal', 'report')),
  "title" text NOT NULL CHECK (length(btrim("title")) BETWEEN 1 AND 200),
  "answers" jsonb NOT NULL CHECK (jsonb_typeof("answers") = 'object'),
  "submittedBy" text NOT NULL REFERENCES public.users("id") ON DELETE RESTRICT,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_submissions_kind_created_idx ON public.project_submissions ("kind", "createdAt" DESC);
CREATE INDEX project_submissions_submitter_idx ON public.project_submissions ("submittedBy");

INSERT INTO public.raavanan_validation_schemas (table_name, fields) VALUES
  ('project_submissions', '{"kind":{"type":"string","required":true,"enum":["proposal","report"]},"title":{"type":"string","required":true,"trim":true,"maxlength":200},"answers":{"type":"mixed","required":true},"submittedBy":{"type":"id","required":true}}'::jsonb);

CREATE TRIGGER raavanan_validate_project_submissions
BEFORE INSERT OR UPDATE ON public.project_submissions
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();

UPDATE public.raavanan_validation_schemas
SET fields = jsonb_set(fields, '{permissions,items,enum}',
  (fields #> '{permissions,items,enum}') || '["page:project_forms"]'::jsonb)
WHERE table_name = 'roles';
