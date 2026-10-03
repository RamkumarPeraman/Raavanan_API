-- Keep database validation in sync with the page permissions accepted by the API.
UPDATE public.raavanan_validation_schemas
SET fields = jsonb_set(
  fields,
  '{permissions,items,enum}',
  (fields #> '{permissions,items,enum}') || '[
    "page:home", "page:projects", "page:events", "page:volunteer",
    "page:donate", "page:blogs", "page:reports", "page:contact",
    "page:our_story", "page:key_figures", "page:profile", "page:my_impact",
    "page:messages", "page:notifications", "page:settings", "page:my_groups",
    "page:admin", "page:roles"
  ]'::jsonb
)
WHERE table_name = 'roles';
