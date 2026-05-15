CREATE OR REPLACE FUNCTION public.get_effective_subscription()
RETURNS TABLE(is_subscribed boolean, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_restaurant_id uuid;
  v_owner_id uuid;
  v_is_sub boolean;
  v_is_admin boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'none'::text;
    RETURN;
  END IF;

  SELECT p.is_subscribed, p.is_admin, p.restaurant_id
    INTO v_is_sub, v_is_admin, v_restaurant_id
  FROM profiles p WHERE p.id = v_user_id;

  IF COALESCE(v_is_sub, false) OR COALESCE(v_is_admin, false) THEN
    RETURN QUERY SELECT true, 'self'::text;
    RETURN;
  END IF;

  IF v_restaurant_id IS NOT NULL THEN
    SELECT r.owner_id INTO v_owner_id FROM restaurants r WHERE r.id = v_restaurant_id;
    IF v_owner_id IS NOT NULL AND v_owner_id <> v_user_id THEN
      SELECT p.is_subscribed, p.is_admin INTO v_is_sub, v_is_admin
      FROM profiles p WHERE p.id = v_owner_id;
      IF COALESCE(v_is_sub, false) OR COALESCE(v_is_admin, false) THEN
        RETURN QUERY SELECT true, 'restaurant'::text;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT false, 'none'::text;
END;
$$;