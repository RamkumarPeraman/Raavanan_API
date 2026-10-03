CREATE FUNCTION public.raavanan_user_stats()
RETURNS TABLE(total bigint, active bigint, inactive bigint, leadership bigint,
  volunteers bigint, members bigint, donors bigint)
LANGUAGE sql STABLE AS $$
  SELECT count(*),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE status = 'inactive'),
    count(*) FILTER (WHERE role IN ('admin', 'super_admin', 'manager')),
    count(*) FILTER (WHERE role IN ('volunteer', 'volunteer_coordinator')),
    count(*) FILTER (WHERE role = 'member'),
    count(*) FILTER (WHERE role = 'donor')
  FROM public.users;
$$;

CREATE FUNCTION public.raavanan_project_metrics()
RETURNS TABLE("totalProjects" bigint, "ongoingProjects" bigint,
  "completedProjects" bigint, "livesImpacted" double precision,
  "volunteersEngaged" double precision, "statesReached" bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(*) FROM public.projects),
    (SELECT count(*) FROM public.projects WHERE status = 'ongoing'),
    (SELECT count(*) FROM public.projects WHERE status = 'completed'),
    (SELECT COALESCE(sum("livesImpacted"), 0)::double precision FROM public.projects),
    (SELECT COALESCE(sum("volunteersEngaged"), 0)::double precision FROM public.projects),
    (SELECT count(DISTINCT state.value)
      FROM public.projects AS project,
        jsonb_array_elements_text(COALESCE(project."statesCovered", '[]'::jsonb)) AS state(value)
      WHERE state.value <> '');
$$;

CREATE FUNCTION public.raavanan_donation_stats(p_month_start timestamptz)
RETURNS TABLE("totalAmount" numeric, "acceptedAmount" numeric,
  "totalDonations" bigint, "monthlyDonors" bigint, "oneTimeDonors" bigint,
  "thisMonthAmount" numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(sum(amount), 0),
    COALESCE(sum(amount) FILTER (WHERE "paymentStatus" = 'accepted'), 0),
    count(*),
    count(*) FILTER (WHERE type = 'monthly'),
    count(*) FILTER (WHERE type <> 'monthly'),
    COALESCE(sum(amount) FILTER (WHERE "createdAt" >= p_month_start), 0)
  FROM public.donations;
$$;

REVOKE ALL ON FUNCTION public.raavanan_user_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_project_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.raavanan_donation_stats(timestamptz) FROM PUBLIC;
