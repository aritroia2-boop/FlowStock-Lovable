/*
  # Update Notification System to Exclude Team Invites

  ## Overview
  This migration updates the notification system to exclude team invitation notifications
  from the unread count and cleans up any pending team invitations since the system
  now uses direct team member assignment instead of invitation-based flow.

  ## Changes

  ### 1. Update get_unread_notification_count Function
  - Exclude team_invite notifications from unread count
  - Only count relevant notification types

  ### 2. Clean Up Existing Team Invitations
  - Cancel all pending team invitation notifications
  - Mark them as read to prevent confusion

  ## Benefits
  - Simplifies team management workflow
  - Prevents confusion from orphaned team invitations
  - Managers can directly add members to teams
  - Cleaner notification system

  ## Important Notes
  - Direct team member addition is now the standard approach
  - Team invitations are deprecated
  - Notification count will no longer include team invites
*/

-- Update the get_unread_notification_count function to exclude team_invite notifications
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

-- Clean up existing pending team invitations
UPDATE notifications
SET 
  status = 'cancelled',
  read_at = NOW()
WHERE 
  type = 'team_invite'
  AND status = 'pending';
