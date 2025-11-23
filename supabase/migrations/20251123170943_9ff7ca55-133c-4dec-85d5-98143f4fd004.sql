/*
  # Create Notifications System
  
  Creates notifications table with functions for creating and managing notifications.
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  read_at timestamptz,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Notifications policies
CREATE POLICY "notification_select"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "notification_insert"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid() OR sender_id IS NULL);

CREATE POLICY "notification_update"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid() OR sender_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid() OR sender_id = auth.uid());

CREATE POLICY "notification_delete"
  ON notifications FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  unread_count integer;
BEGIN
  SELECT COUNT(*) INTO unread_count
  FROM notifications
  WHERE recipient_id = auth.uid()
  AND read_at IS NULL
  AND status = 'pending'
  AND type != 'team_invite';
  
  RETURN COALESCE(unread_count, 0);
END;
$$;

-- Function to create team invite notification
CREATE OR REPLACE FUNCTION create_team_invite_notification(
  p_recipient_id uuid,
  p_team_id uuid,
  p_role text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_name text;
  v_restaurant_id uuid;
  v_restaurant_name text;
  v_sender_name text;
  v_sender_restaurant_id uuid;
  v_recipient_restaurant_id uuid;
  v_notification_id uuid;
  v_existing_member_count integer;
BEGIN
  SELECT name, restaurant_id
  INTO v_sender_name, v_sender_restaurant_id
  FROM profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender profile not found';
  END IF;

  SELECT restaurant_id
  INTO v_recipient_restaurant_id
  FROM profiles WHERE id = p_recipient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient profile not found';
  END IF;

  SELECT teams.name, teams.restaurant_id, restaurants.name
  INTO v_team_name, v_restaurant_id, v_restaurant_name
  FROM teams
  JOIN restaurants ON restaurants.id = teams.restaurant_id
  WHERE teams.id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team or restaurant not found';
  END IF;

  IF v_sender_restaurant_id != v_restaurant_id THEN
    RAISE EXCEPTION 'You do not have permission to invite members to this team';
  END IF;

  IF v_recipient_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'User must be added as an employee before being invited to a team';
  END IF;

  IF v_recipient_restaurant_id != v_restaurant_id THEN
    RAISE EXCEPTION 'User is not an employee of this restaurant';
  END IF;

  SELECT COUNT(*) INTO v_existing_member_count
  FROM team_members
  WHERE team_id = p_team_id AND profile_id = p_recipient_id AND status = 'active';

  IF v_existing_member_count > 0 THEN
    RAISE EXCEPTION 'User is already a member of this team';
  END IF;

  SELECT COUNT(*) INTO v_existing_member_count
  FROM notifications
  WHERE recipient_id = p_recipient_id
  AND team_id = p_team_id
  AND type = 'team_invite'
  AND status = 'pending';

  IF v_existing_member_count > 0 THEN
    RAISE EXCEPTION 'User already has a pending invitation to this team';
  END IF;

  INSERT INTO notifications (
    recipient_id, sender_id, type, title, message, status, team_id, metadata
  ) VALUES (
    p_recipient_id,
    auth.uid(),
    'team_invite',
    'Team Invitation',
    'You have been invited to join ' || v_team_name || ' at ' || v_restaurant_name || ' as ' || p_role,
    'pending',
    p_team_id,
    jsonb_build_object(
      'team_name', v_team_name,
      'restaurant_name', v_restaurant_name,
      'sender_name', v_sender_name,
      'role', p_role
    )
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_invite_notification(uuid, uuid, text) TO authenticated;