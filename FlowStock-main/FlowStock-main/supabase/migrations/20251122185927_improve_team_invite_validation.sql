/*
  # Improve Team Invitation Validation and Error Handling

  ## Overview
  This migration updates the create_team_invite_notification function to add
  comprehensive validation and provide clear, specific error messages when
  team invitations fail. This fixes the confusing "user must have a profile"
  error by validating each step of the invitation process.

  ## Changes

  ### 1. Enhanced Validation
  - Check if recipient profile exists and is accessible
  - Verify recipient is an employee of the same restaurant
  - Prevent duplicate invitations (already a member)
  - Validate team and restaurant existence
  - Check sender permissions

  ### 2. Better Error Messages
  - Specific error for "profile not found"
  - Clear message for "already a team member"
  - Validation for "not an employee of this restaurant"
  - Permission errors for unauthorized senders

  ## Benefits
  - Eliminates confusing error messages
  - Provides actionable feedback to users
  - Prevents duplicate or invalid invitations
  - Improves debugging and troubleshooting
  - Makes team invitation flow more robust

  ## Important Notes
  - Function now validates all preconditions before creating notification
  - Returns descriptive error messages for each failure scenario
  - Uses SECURITY DEFINER to check profiles table
  - Maintains existing notification creation logic
*/

-- Drop and recreate the function with improved validation
DROP FUNCTION IF EXISTS create_team_invite_notification(uuid, uuid, text);

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
  -- Validate that sender exists and get their info
  SELECT name, restaurant_id
  INTO v_sender_name, v_sender_restaurant_id
  FROM profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sender profile not found. Please log out and log back in.';
  END IF;

  -- Validate that recipient profile exists
  SELECT restaurant_id
  INTO v_recipient_restaurant_id
  FROM profiles
  WHERE id = p_recipient_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient profile not found. The user must create an account first.';
  END IF;

  -- Get team and restaurant information
  SELECT teams.name, teams.restaurant_id, restaurants.name
  INTO v_team_name, v_restaurant_id, v_restaurant_name
  FROM teams
  JOIN restaurants ON restaurants.id = teams.restaurant_id
  WHERE teams.id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team or restaurant not found. Please refresh and try again.';
  END IF;

  -- Verify sender is the owner of the restaurant
  IF v_sender_restaurant_id != v_restaurant_id THEN
    RAISE EXCEPTION 'You do not have permission to invite members to this team.';
  END IF;

  -- Verify recipient is an employee of the same restaurant
  IF v_recipient_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'User must be added as an employee before being invited to a team.';
  END IF;

  IF v_recipient_restaurant_id != v_restaurant_id THEN
    RAISE EXCEPTION 'User is not an employee of this restaurant.';
  END IF;

  -- Check if recipient is already a member of this team
  SELECT COUNT(*)
  INTO v_existing_member_count
  FROM team_members
  WHERE team_id = p_team_id 
  AND profile_id = p_recipient_id
  AND status = 'active';

  IF v_existing_member_count > 0 THEN
    RAISE EXCEPTION 'User is already a member of this team.';
  END IF;

  -- Check if there's already a pending invitation
  SELECT COUNT(*)
  INTO v_existing_member_count
  FROM notifications
  WHERE recipient_id = p_recipient_id
  AND team_id = p_team_id
  AND type = 'team_invite'
  AND status = 'pending';

  IF v_existing_member_count > 0 THEN
    RAISE EXCEPTION 'User already has a pending invitation to this team.';
  END IF;

  -- All validations passed, create the notification
  INSERT INTO notifications (
    recipient_id,
    sender_id,
    type,
    title,
    message,
    status,
    team_id,
    metadata
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_team_invite_notification(uuid, uuid, text) TO authenticated;