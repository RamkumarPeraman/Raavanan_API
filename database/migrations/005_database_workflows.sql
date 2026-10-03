-- Keep event counts consistent for every writer, including imports and SQL clients.
CREATE FUNCTION public.raavanan_sync_event_registration_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."registered" := jsonb_array_length(COALESCE(NEW."attendees", '[]'::jsonb));
  RETURN NEW;
END
$$;

CREATE TRIGGER raavanan_event_registration_count
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.raavanan_sync_event_registration_count();

-- The row lock makes the capacity check and attendee append one atomic operation.
CREATE FUNCTION public.raavanan_register_for_event(p_event_id text, p_user_id text)
RETURNS TABLE(result text, attendee jsonb, registration_count integer)
LANGUAGE plpgsql AS $$
DECLARE
  event_row public.events%ROWTYPE;
  user_row public.users%ROWTYPE;
  new_attendee jsonb;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'event_not_found'::text, NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  SELECT * INTO user_row FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'user_not_found'::text, NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(event_row."attendees", '[]'::jsonb)) AS item
    WHERE item->>'userId' = p_user_id
  ) THEN
    RETURN QUERY SELECT 'already_registered'::text, NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  IF event_row.capacity > 0 AND jsonb_array_length(COALESCE(event_row."attendees", '[]'::jsonb)) >= event_row.capacity THEN
    RETURN QUERY SELECT 'full'::text, NULL::jsonb, NULL::integer;
    RETURN;
  END IF;

  new_attendee := jsonb_build_object('userId', user_row.id, 'name', user_row.name,
    'email', user_row.email, 'registeredAt', now());
  UPDATE public.events
  SET "attendees" = COALESCE("attendees", '[]'::jsonb) || jsonb_build_array(new_attendee),
      "updatedAt" = now()
  WHERE id = p_event_id
  RETURNING "registered"::integer INTO registration_count;
  result := 'registered';
  attendee := new_attendee;
  RETURN NEXT;
END
$$;

-- A message insert or delete updates the conversation preview for all writers.
CREATE FUNCTION public.raavanan_sync_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  latest public.messages%ROWTYPE;
  conversation_id text;
BEGIN
  conversation_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.conversation ELSE NEW.conversation END;
  SELECT * INTO latest FROM public.messages
    WHERE conversation = conversation_id
    ORDER BY "createdAt" DESC, id DESC LIMIT 1;
  UPDATE public.conversations SET
    "lastMessage" = CASE WHEN latest.id IS NULL
      THEN jsonb_build_object('text', '', 'sender', NULL, 'sentAt', NULL)
      ELSE jsonb_build_object('text', latest.content, 'sender', latest.sender, 'sentAt', latest."createdAt") END,
    "updatedAt" = now()
  WHERE id = conversation_id;
  RETURN NULL;
END
$$;

CREATE TRIGGER raavanan_conversation_last_message
AFTER INSERT OR DELETE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.raavanan_sync_conversation_last_message();

REVOKE ALL ON FUNCTION public.raavanan_sync_event_registration_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_register_for_event(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_sync_conversation_last_message() FROM PUBLIC;
