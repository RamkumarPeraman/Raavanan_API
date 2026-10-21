ALTER TABLE public.users
  ADD COLUMN "wingId" text REFERENCES public.wings("id") ON DELETE RESTRICT,
  ADD COLUMN "departmentId" text REFERENCES public.sub_wings("id") ON DELETE RESTRICT;

CREATE INDEX users_wing_id_idx ON public.users ("wingId");
CREATE INDEX users_department_id_idx ON public.users ("departmentId");

UPDATE public.raavanan_validation_schemas
SET fields = fields || '{"wingId":{"type":"id","default":null},"departmentId":{"type":"id","default":null}}'::jsonb
WHERE table_name = 'users';
