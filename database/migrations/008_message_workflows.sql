-- Message workflows added after 005 was applied.
-- A single call sends the message, updates the sender's read position, and
-- creates recipient notifications. The trigger above maintains the preview.
CREATE FUNCTION public.raavanan_send_message(
  p_conversation_id text, p_sender_id text, p_message_id text, p_content text
)
RETURNS TABLE(result text, message_id text) LANGUAGE plpgsql AS $$
DECLARE
  conversation_row public.conversations%ROWTYPE;
  sender_row public.users%ROWTYPE;
  sent_at timestamptz := now();
BEGIN
  SELECT * INTO conversation_row FROM public.conversations
    WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(conversation_row.participants) AS p
    WHERE p->>'user' = p_sender_id
  ) THEN
    RETURN QUERY SELECT 'conversation_not_found'::text, NULL::text;
    RETURN;
  END IF;

  SELECT * INTO sender_row FROM public.users WHERE id = p_sender_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'user_not_found'::text, NULL::text;
    RETURN;
  END IF;

  IF p_content IS NULL OR length(btrim(p_content)) = 0 OR length(p_content) > 3000 THEN
    RETURN QUERY SELECT 'invalid_content'::text, NULL::text;
    RETURN;
  END IF;

  INSERT INTO public.messages (id, conversation, sender, content, "readBy", "createdAt", "updatedAt")
  VALUES (p_message_id, p_conversation_id, p_sender_id, btrim(p_content),
    jsonb_build_array(jsonb_build_object('user', p_sender_id, 'seenAt', sent_at)), sent_at, sent_at);

  UPDATE public.conversations SET participants = (
    SELECT jsonb_agg(
      CASE WHEN p.item->>'user' = p_sender_id
        THEN jsonb_set(p.item, '{lastReadAt}', to_jsonb(sent_at))
        ELSE p.item END ORDER BY p.position
    ) FROM jsonb_array_elements(participants) WITH ORDINALITY AS p(item, position)
  ) WHERE id = p_conversation_id;

  INSERT INTO public.notifications
    (id, "user", type, title, message, conversation, "relatedMessage", sender, "isRead", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, p.item->>'user',
    CASE WHEN conversation_row.type = 'group' THEN 'group_message' ELSE 'direct_message' END,
    CASE WHEN conversation_row.type = 'group'
      THEN sender_row.name || ' in ' || conversation_row.name
      ELSE 'New message from ' || sender_row.name END,
    btrim(p_content), p_conversation_id, p_message_id, p_sender_id, false, sent_at, sent_at
  FROM jsonb_array_elements(conversation_row.participants) AS p(item)
  WHERE p.item->>'user' <> p_sender_id;

  RETURN QUERY SELECT 'sent'::text, p_message_id;
END
$$;

-- Update all read state together so repeated calls cannot add duplicate receipts.
CREATE FUNCTION public.raavanan_mark_conversation_read(p_conversation_id text, p_user_id text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  seen_at timestamptz := now();
  participant_list jsonb;
BEGIN
  SELECT participants INTO participant_list FROM public.conversations
    WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(participant_list) AS p WHERE p->>'user' = p_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.conversations SET
    participants = (
      SELECT jsonb_agg(
        CASE WHEN p.item->>'user' = p_user_id
          THEN jsonb_set(p.item, '{lastReadAt}', to_jsonb(seen_at))
          ELSE p.item END ORDER BY p.position
      )
      FROM jsonb_array_elements(participants) WITH ORDINALITY AS p(item, position)
    ),
    "updatedAt" = seen_at
  WHERE id = p_conversation_id;

  UPDATE public.messages SET
    "readBy" = COALESCE("readBy", '[]'::jsonb) ||
      jsonb_build_array(jsonb_build_object('user', p_user_id, 'seenAt', seen_at)),
    "updatedAt" = seen_at
  WHERE conversation = p_conversation_id AND sender <> p_user_id
    AND NOT (COALESCE("readBy", '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('user', p_user_id)));

  UPDATE public.notifications SET "isRead" = true, "updatedAt" = seen_at
  WHERE "user" = p_user_id AND conversation = p_conversation_id AND "isRead" = false;
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.raavanan_send_message(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_mark_conversation_read(text, text) FROM PUBLIC;
