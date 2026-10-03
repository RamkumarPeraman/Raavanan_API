-- Database-owned validation for every application record. The schema rows below
-- are a snapshot of the model definitions at this migration version.
CREATE TABLE public.raavanan_validation_schemas (
  table_name text PRIMARY KEY,
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'object')
);

CREATE FUNCTION public.raavanan_validate_value(p_value jsonb, p_spec jsonb, p_path text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  expected_type text := p_spec->>'type';
  actual_type text;
  item jsonb;
  child record;
  index_number integer;
  text_value text;
BEGIN
  IF p_value IS NULL OR p_value = 'null'::jsonb THEN
    IF COALESCE((p_spec->>'required')::boolean, false) THEN
      RAISE EXCEPTION '% is required', p_path USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  actual_type := jsonb_typeof(p_value);
  IF expected_type IN ('string', 'id', 'date') THEN
    IF actual_type <> 'string' THEN
      RAISE EXCEPTION '% must be a string', p_path USING ERRCODE = '23514';
    END IF;
    text_value := p_value #>> '{}';
    IF COALESCE((p_spec->>'required')::boolean, false) AND length(btrim(text_value)) = 0 THEN
      RAISE EXCEPTION '% cannot be empty', p_path USING ERRCODE = '23514';
    END IF;
    IF p_spec ? 'maxlength' AND length(text_value) > (p_spec->>'maxlength')::integer THEN
      RAISE EXCEPTION '% exceeds maximum length', p_path USING ERRCODE = '23514';
    END IF;
    IF expected_type = 'date' THEN
      BEGIN
        PERFORM text_value::timestamptz;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION '% must be a valid date', p_path USING ERRCODE = '23514';
      END;
    END IF;
  ELSIF expected_type = 'number' THEN
    IF actual_type <> 'number' THEN
      RAISE EXCEPTION '% must be a number', p_path USING ERRCODE = '23514';
    END IF;
    IF p_spec ? 'min' AND (p_value #>> '{}')::numeric < (p_spec->>'min')::numeric THEN
      RAISE EXCEPTION '% is below minimum', p_path USING ERRCODE = '23514';
    END IF;
    IF p_spec ? 'max' AND (p_value #>> '{}')::numeric > (p_spec->>'max')::numeric THEN
      RAISE EXCEPTION '% exceeds maximum', p_path USING ERRCODE = '23514';
    END IF;
  ELSIF expected_type = 'boolean' THEN
    IF actual_type <> 'boolean' THEN
      RAISE EXCEPTION '% must be a boolean', p_path USING ERRCODE = '23514';
    END IF;
  ELSIF expected_type = 'array' THEN
    IF actual_type <> 'array' THEN
      RAISE EXCEPTION '% must be an array', p_path USING ERRCODE = '23514';
    END IF;
    IF p_spec ? 'minItems' AND jsonb_array_length(p_value) < (p_spec->>'minItems')::integer THEN
      RAISE EXCEPTION '% has too few items', p_path USING ERRCODE = '23514';
    END IF;
    index_number := 0;
    FOR item IN SELECT element.value FROM jsonb_array_elements(p_value) AS element(value) LOOP
      PERFORM public.raavanan_validate_value(item, p_spec->'items', p_path || '[' || index_number || ']');
      index_number := index_number + 1;
    END LOOP;
  ELSIF expected_type = 'object' THEN
    IF actual_type <> 'object' THEN
      RAISE EXCEPTION '% must be an object', p_path USING ERRCODE = '23514';
    END IF;
    FOR child IN SELECT key, value FROM jsonb_each(COALESCE(p_spec->'properties', '{}'::jsonb)) LOOP
      PERFORM public.raavanan_validate_value(p_value->child.key, child.value, p_path || '.' || child.key);
    END LOOP;
  ELSIF expected_type = 'map' THEN
    IF actual_type <> 'object' THEN
      RAISE EXCEPTION '% must be an object', p_path USING ERRCODE = '23514';
    END IF;
    FOR child IN SELECT key, value FROM jsonb_each(p_value) LOOP
      PERFORM public.raavanan_validate_value(child.value, p_spec->'values', p_path || '.' || child.key);
    END LOOP;
  ELSIF expected_type IS DISTINCT FROM 'mixed' THEN
    RAISE EXCEPTION '% has unsupported validation type', p_path USING ERRCODE = '23514';
  END IF;

  IF p_spec ? 'enum' AND NOT (p_spec->'enum' @> jsonb_build_array(p_value)) THEN
    RAISE EXCEPTION '% has an invalid value', p_path USING ERRCODE = '23514';
  END IF;
END
$$;

CREATE FUNCTION public.raavanan_validate_record()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  field_spec jsonb;
BEGIN
  SELECT fields INTO field_spec FROM public.raavanan_validation_schemas WHERE table_name = TG_TABLE_NAME;
  IF field_spec IS NULL THEN
    RAISE EXCEPTION 'Missing validation schema for %', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  PERFORM public.raavanan_validate_value(
    to_jsonb(NEW), jsonb_build_object('type', 'object', 'properties', field_spec), TG_TABLE_NAME
  );
  IF field_spec ? 'email' AND to_jsonb(NEW)->>'email' IS NOT NULL
    AND (to_jsonb(NEW)->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION '%.email must be a valid email address', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'services' AND length(btrim(to_jsonb(NEW)->>'message')) < 10 THEN
    RAISE EXCEPTION 'services.message must contain at least 10 characters' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.raavanan_validate_value(jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_validate_record() FROM PUBLIC;

-- Generated schema inserts and triggers follow.
INSERT INTO public.raavanan_validation_schemas (table_name, fields) VALUES
  ('admin_settings', '{"key":{"type":"string","unique":true,"default":"global"},"donationQrImage":{"type":"string","default":""},"bankDetails":{"type":"object","properties":{"accountHolder":{"type":"string","default":"Partha Sarathi V"},"bank":{"type":"string","default":"Canara Bank"},"branch":{"type":"string","default":"Pattiveeranpatti"},"accountNo":{"type":"string","default":"110301563866"},"ifscCode":{"type":"string","default":"CNRB0008438"}},"default":{}},"heroNewsCarousel":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","required":true},"category":{"type":"string","default":"Latest News"},"title":{"type":"string","default":""},"summary":{"type":"string","default":""},"image":{"type":"string","default":""},"link":{"type":"string","default":""},"buttonLabel":{"type":"string","default":"Read more"}}},"default":[]}}'::jsonb),
  ('blogs', '{"title":{"type":"string","required":true,"trim":true},"excerpt":{"type":"string","required":true,"trim":true},"content":{"type":"string","required":true},"author":{"type":"string","required":true,"trim":true},"date":{"type":"date","required":true},"category":{"type":"string","required":true,"trim":true},"image":{"type":"string","default":""},"readTime":{"type":"number","min":1,"default":1},"tags":{"type":"array","items":{"type":"string"},"default":[]}}'::jsonb),
  ('conversations', '{"type":{"type":"string","enum":["direct","group"],"default":"direct"},"name":{"type":"string","trim":true,"default":""},"participants":{"type":"array","items":{"type":"object","properties":{"user":{"type":"id","required":true,"ref":"User"},"joinedAt":{"type":"date","defaultNow":true},"lastReadAt":{"type":"date","default":null}}},"minItems":2,"required":true},"createdBy":{"type":"id","required":true,"ref":"User"},"directKey":{"type":"string","unique":true},"lastMessage":{"type":"object","properties":{"text":{"type":"string","default":""},"sender":{"type":"id","ref":"User","default":null},"sentAt":{"type":"date","default":null}},"default":{}}}'::jsonb),
  ('donations', '{"name":{"type":"string","required":true,"trim":true},"email":{"type":"string","required":true,"trim":true,"lowercase":true},"phone":{"type":"string","required":true,"trim":true},"amount":{"type":"number","required":true,"min":1},"type":{"type":"string","enum":["one-time","monthly"],"default":"one-time"},"project":{"type":"string","default":"general"},"paymentMethod":{"type":"string","default":"upi"},"paymentStatus":{"type":"string","enum":["pending","accepted","rejected","completed","failed"],"default":"pending"},"address":{"type":"string","default":""},"city":{"type":"string","default":""},"state":{"type":"string","default":""},"pincode":{"type":"string","default":""},"pan":{"type":"string","default":""},"anonymous":{"type":"boolean","default":false},"paymentId":{"type":"string","default":""},"transactionId":{"type":"string","default":""},"paymentScreenshot":{"type":"string","default":""},"message":{"type":"string","default":""}}'::jsonb),
  ('events', '{"title":{"type":"string","required":true,"trim":true},"description":{"type":"string","required":true,"trim":true},"type":{"type":"string","required":true,"trim":true},"category":{"type":"string","default":""},"date":{"type":"date","required":true},"time":{"type":"string","required":true,"trim":true},"location":{"type":"string","required":true,"trim":true},"capacity":{"type":"number","min":0,"default":0},"registered":{"type":"number","min":0,"default":0},"price":{"type":"number","min":0,"default":0},"speakers":{"type":"array","items":{"type":"string"},"default":[]},"image":{"type":"string","default":""},"attendees":{"type":"array","items":{"type":"object","properties":{"userId":{"type":"id","ref":"User","default":null},"name":{"type":"string","required":true,"trim":true},"email":{"type":"string","required":true,"trim":true,"lowercase":true},"registeredAt":{"type":"date","defaultNow":true}}},"default":[]}}'::jsonb),
  ('messages', '{"conversation":{"type":"id","required":true,"ref":"Conversation","index":true},"sender":{"type":"id","required":true,"ref":"User"},"content":{"type":"string","required":true,"trim":true,"maxlength":3000},"readBy":{"type":"array","items":{"type":"object","properties":{"user":{"type":"id","required":true,"ref":"User"},"seenAt":{"type":"date","defaultNow":true}}},"default":[]}}'::jsonb),
  ('notifications', '{"user":{"type":"id","required":true,"ref":"User","index":true},"type":{"type":"string","enum":["direct_message","group_message"],"default":"direct_message"},"title":{"type":"string","required":true,"trim":true},"message":{"type":"string","required":true,"trim":true},"conversation":{"type":"id","ref":"Conversation","default":null},"relatedMessage":{"type":"id","ref":"Message","default":null},"sender":{"type":"id","ref":"User","default":null},"isRead":{"type":"boolean","default":false}}'::jsonb),
  ('projects', '{"title":{"type":"string","required":true,"trim":true},"description":{"type":"string","required":true,"trim":true},"longDescription":{"type":"string","default":""},"image":{"type":"string","default":""},"gallery":{"type":"array","items":{"type":"string"},"default":[]},"status":{"type":"string","enum":["ongoing","completed","planned"],"default":"ongoing"},"category":{"type":"string","required":true,"trim":true},"progress":{"type":"number","min":0,"max":100,"default":0},"goal":{"type":"number","min":0,"default":0},"raised":{"type":"number","min":0,"default":0},"location":{"type":"string","default":""},"statesCovered":{"type":"array","items":{"type":"string"},"default":[]},"startDate":{"type":"date"},"endDate":{"type":"date"},"impact":{"type":"map","values":{"type":"number"},"default":{}},"livesImpacted":{"type":"number","min":0,"default":0},"volunteersEngaged":{"type":"number","min":0,"default":0},"objectives":{"type":"array","items":{"type":"string"},"default":[]},"achievements":{"type":"array","items":{"type":"string"},"default":[]},"partners":{"type":"array","items":{"type":"string"},"default":[]},"funding":{"type":"array","items":{"type":"string"},"default":[]},"reportUrl":{"type":"string","default":""},"featured":{"type":"boolean","default":false}}'::jsonb),
  ('reports', '{"title":{"type":"string","required":true,"trim":true},"type":{"type":"string","required":true,"enum":["annual","quarterly","impact","financial","project","field_visit","sustainability","publication"]},"category":{"type":"string","default":""},"year":{"type":"string","default":""},"period":{"type":"string","default":""},"publishedDate":{"type":"date","required":true},"description":{"type":"string","required":true},"summary":{"type":"string","default":""},"fileSize":{"type":"string","default":""},"pages":{"type":"number","min":0,"default":0},"downloads":{"type":"number","min":0,"default":0},"views":{"type":"number","min":0,"default":0},"featured":{"type":"boolean","default":false},"thumbnail":{"type":"string","default":""},"url":{"type":"string","default":""},"metrics":{"type":"map","values":{"type":"string"},"default":{}},"highlights":{"type":"array","items":{"type":"string"},"default":[]},"projects":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","required":true,"trim":true},"description":{"type":"string","default":""},"beneficiaries":{"type":"string","default":""},"budget":{"type":"string","default":""}}},"default":[]},"testimonials":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","required":true,"trim":true},"role":{"type":"string","default":""},"quote":{"type":"string","required":true}}},"default":[]},"financial":{"type":"object","properties":{"income":{"type":"string","default":""},"expenses":{"type":"string","default":""},"breakdown":{"type":"map","values":{"type":"string"},"default":{}}}},"gallery":{"type":"array","items":{"type":"string"},"default":[]},"status":{"type":"string","enum":["draft","published","archived"],"default":"published"}}'::jsonb),
  ('roles', '{"name":{"type":"string","required":true,"unique":true,"trim":true,"lowercase":true},"displayName":{"type":"string","required":true,"trim":true},"description":{"type":"string","trim":true,"default":""},"permissions":{"type":"array","items":{"type":"string","enum":["users:read","users:write","users:delete","roles:read","roles:write","roles:delete","volunteers:read","volunteers:write","volunteers:delete","projects:read","projects:write","projects:delete","events:read","events:write","events:delete","blogs:read","blogs:write","blogs:delete","donations:read","donations:write","donations:delete","reports:read","reports:write","reports:delete","services:read","services:write","services:delete"]},"default":[]},"isSystem":{"type":"boolean","default":false},"status":{"type":"string","enum":["active","inactive"],"default":"active"},"color":{"type":"string","default":"#0d9488"}}'::jsonb),
  ('services', '{"name":{"type":"string","required":true,"trim":true},"email":{"type":"string","required":true,"trim":true,"lowercase":true},"phone":{"type":"string","required":true,"trim":true},"category":{"type":"string","enum":["general","education","healthcare","food","shelter","other"],"default":"general"},"message":{"type":"string","required":true,"trim":true},"status":{"type":"string","enum":["pending","processing","completed","rejected"],"default":"pending"}}'::jsonb),
  ('password_reset_otps', '{"email":{"type":"string","required":true,"unique":true,"trim":true,"lowercase":true},"otpHash":{"type":"string","required":true,"select":false},"expiresAt":{"type":"date","required":true},"lastSentAt":{"type":"date","required":true},"attempts":{"type":"number","default":0,"min":0},"verifiedAt":{"type":"date"}}'::jsonb),
  ('signup_otps', '{"email":{"type":"string","required":true,"unique":true,"trim":true,"lowercase":true},"otpHash":{"type":"string","required":true,"select":false},"signupData":{"type":"mixed","required":true},"expiresAt":{"type":"date","required":true},"lastSentAt":{"type":"date","required":true},"attempts":{"type":"number","default":0,"min":0}}'::jsonb),
  ('users', '{"name":{"type":"string","required":true,"trim":true},"email":{"type":"string","required":true,"unique":true,"trim":true,"lowercase":true},"phone":{"type":"string","default":""},"passwordHash":{"type":"string","required":true},"role":{"type":"string","default":"member"},"status":{"type":"string","enum":["active","inactive"],"default":"active"},"department":{"type":"string","default":""},"location":{"type":"string","default":""},"profileImage":{"type":"string","default":null},"bio":{"type":"string","default":""},"dateOfBirth":{"type":"string","default":""},"gender":{"type":"string","default":""},"bloodGroup":{"type":"string","default":""},"address":{"type":"object","properties":{"street":{"type":"string","default":""},"city":{"type":"string","default":""},"state":{"type":"string","default":""},"pincode":{"type":"string","default":""},"country":{"type":"string","default":"India"}},"default":{}},"occupation":{"type":"string","default":""},"organization":{"type":"string","default":""},"joinDate":{"type":"string","defaultToday":true},"membershipId":{"type":"string","unique":true},"membershipType":{"type":"string","default":"Regular Member"},"socialLinks":{"type":"object","properties":{"facebook":{"type":"string","default":""},"twitter":{"type":"string","default":""},"linkedin":{"type":"string","default":""},"instagram":{"type":"string","default":""}},"default":{}},"interests":{"type":"array","items":{"type":"string"},"default":[]},"skills":{"type":"array","items":{"type":"string"},"default":[]},"preferences":{"type":"object","properties":{"emailNotifications":{"type":"boolean","default":true},"smsNotifications":{"type":"boolean","default":false},"whatsappUpdates":{"type":"boolean","default":true},"newsletter":{"type":"boolean","default":true},"eventReminders":{"type":"boolean","default":true},"volunteerOpportunities":{"type":"boolean","default":true}},"default":{}},"privacy":{"type":"object","properties":{"showEmail":{"type":"boolean","default":false},"showPhone":{"type":"boolean","default":true},"showAddress":{"type":"boolean","default":false},"showDonations":{"type":"boolean","default":true}},"default":{}},"stats":{"type":"object","properties":{"volunteerHours":{"type":"number","default":0},"eventsAttended":{"type":"number","default":0},"donationsMade":{"type":"number","default":0},"totalDonated":{"type":"number","default":0},"projectsSupported":{"type":"number","default":0},"badges":{"type":"number","default":0},"impactScore":{"type":"number","default":0}},"default":{}},"lastActive":{"type":"date","defaultNow":true}}'::jsonb),
  ('volunteers', '{"fullName":{"type":"string","required":true},"email":{"type":"string","required":true,"unique":true,"trim":true,"lowercase":true},"phone":{"type":"string","required":true},"address":{"type":"string","default":""},"gender":{"type":"string","default":""},"city":{"type":"string","default":""},"state":{"type":"string","default":""},"pincode":{"type":"string","default":""},"dateOfBirth":{"type":"string","default":""},"education":{"type":"string","default":""},"educationOther":{"type":"string","default":""},"institution":{"type":"string","default":""},"occupation":{"type":"string","default":""},"occupationOther":{"type":"string","default":""},"skills":{"type":"array","items":{"type":"string"},"default":[]},"skillsOther":{"type":"string","default":""},"interests":{"type":"array","items":{"type":"string"},"default":[]},"capacity":{"type":"array","items":{"type":"string"},"default":[]},"capacityOther":{"type":"string","default":""},"availability":{"type":"mixed","default":{}},"hoursPerWeek":{"type":"string","default":""},"experience":{"type":"string","default":""},"motivation":{"type":"string","default":""},"previousVolunteer":{"type":"string","default":""},"emergencyContact":{"type":"object","properties":{"name":{"type":"string","default":""},"phone":{"type":"string","default":""},"relationship":{"type":"string","default":""}},"default":{}},"hearAbout":{"type":"string","default":""},"hearAboutOther":{"type":"string","default":""},"selectedOpportunityId":{"type":"string","default":""},"selectedOpportunityTitle":{"type":"string","default":""},"corePurpose":{"type":"string","default":""},"newLaw":{"type":"string","default":""},"viewOnSociety":{"type":"string","default":""},"leadershipAction":{"type":"string","default":""},"dailyHabit":{"type":"string","default":""},"agreeConduct":{"type":"boolean","default":false},"agreeDeclaration":{"type":"boolean","default":false},"status":{"type":"string","enum":["pending","approved","rejected"],"default":"pending"},"passwordHash":{"type":"string","required":true,"select":false}}'::jsonb),
  ('volunteer_opportunities', '{"title":{"type":"string","required":true,"trim":true},"category":{"type":"string","required":true,"trim":true},"location":{"type":"string","required":true,"trim":true},"commitment":{"type":"string","required":true,"trim":true},"spots":{"type":"number","min":1,"default":1},"description":{"type":"string","required":true,"trim":true},"requirements":{"type":"array","items":{"type":"string"},"default":[]},"image":{"type":"string","default":""},"status":{"type":"string","enum":["active","inactive"],"default":"active"}}'::jsonb);
CREATE TRIGGER raavanan_validate_admin_settings
BEFORE INSERT OR UPDATE ON public.admin_settings
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_blogs
BEFORE INSERT OR UPDATE ON public.blogs
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_conversations
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_donations
BEFORE INSERT OR UPDATE ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_events
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_messages
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_notifications
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_projects
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_reports
BEFORE INSERT OR UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_roles
BEFORE INSERT OR UPDATE ON public.roles
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_services
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_password_reset_otps
BEFORE INSERT OR UPDATE ON public.password_reset_otps
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_signup_otps
BEFORE INSERT OR UPDATE ON public.signup_otps
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_users
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_volunteers
BEFORE INSERT OR UPDATE ON public.volunteers
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
CREATE TRIGGER raavanan_validate_volunteer_opportunities
BEFORE INSERT OR UPDATE ON public.volunteer_opportunities
FOR EACH ROW EXECUTE FUNCTION public.raavanan_validate_record();
