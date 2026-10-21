CREATE TABLE public.wings (
  "id" text PRIMARY KEY,
  "name" text NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  "description" text NOT NULL DEFAULT '' CHECK (length("description") <= 1000),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wings_name_unique ON public.wings (lower(btrim("name")));

CREATE TABLE public.sub_wings (
  "id" text PRIMARY KEY,
  "wingId" text NOT NULL REFERENCES public.wings("id") ON DELETE RESTRICT,
  "name" text NOT NULL CHECK (length(btrim("name")) BETWEEN 1 AND 120),
  "description" text NOT NULL DEFAULT '' CHECK (length("description") <= 1000),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sub_wings_name_per_wing_unique ON public.sub_wings ("wingId", lower(btrim("name")));
CREATE INDEX sub_wings_wing_id_idx ON public.sub_wings ("wingId");

INSERT INTO public.raavanan_validation_schemas (table_name, fields) VALUES
  ('wings', '{"name":{"type":"string","required":true,"trim":true,"maxlength":120},"description":{"type":"string","trim":true,"default":"","maxlength":1000}}'::jsonb),
  ('sub_wings', '{"wingId":{"type":"id","required":true},"name":{"type":"string","required":true,"trim":true,"maxlength":120},"description":{"type":"string","trim":true,"default":"","maxlength":1000}}'::jsonb);

CREATE TRIGGER raavanan_validate_wings
BEFORE INSERT OR UPDATE ON public.wings
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();

CREATE TRIGGER raavanan_validate_sub_wings
BEFORE INSERT OR UPDATE ON public.sub_wings
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();

UPDATE public.raavanan_validation_schemas
SET fields = jsonb_set(fields, '{permissions,items,enum}',
  (fields #> '{permissions,items,enum}') || '["page:wings"]'::jsonb)
WHERE table_name = 'roles';
