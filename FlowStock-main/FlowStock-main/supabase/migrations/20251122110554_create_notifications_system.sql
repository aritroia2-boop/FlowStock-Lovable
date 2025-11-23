/*
  # Create Notifications System for Team Invites

  ## Overview
  This migration creates a comprehensive notification system to support team invitations
  and other future notification types. Users will receive notifications when invited to
  teams and can accept or decline through the UI.

  ## New Tables

  ### 1. `notifications`
  Stores all notifications for users (team invites, alerts, etc.)
  - `id` (uuid, primary key) - Unique notification identifier
  - `recipient_id` (uuid, foreign key) - User receiving the notification
  - `sender_id` (uuid, foreign key, nullable) - User who triggered the notification
  - `type` (text) - Notification type (team_invite, alert, etc.)
  - `title` (text) - Notification title/subject
  - `message` (text) - Detailed notification message
  - `status` (text) - Status: pending, accepted, declined, cancelled
  - `team_id` (uuid, foreign key, nullable) - Related team if applicable
  - `metadata` (jsonb, nullable) - Additional data (team name, role, etc.)
  - `read_at` (timestamptz, nullable) - When notification was read
  - `created_at` (timestamptz) - When notification was created

  ## Changes to Existing Tables
  - Add status field to team_members (invited, active) to track invite status

  ## Security
  - RLS enabled on notifications table
  - Users can only view their own notifications
  - Users can only update their own notifications (mark as read, accept/decline)
  - Owners can create notifications for their restaurant employees

  ## Notification Flow
  1. Owner invites employee to team
  2. Notification created with type='team_invite', status='pending'
  3. Employee receives notification
  4. Employee accepts: team_member created with status='active', notification updated
  5. Employee declines: notification updated to 'declined'
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
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_notification_type CHECK (type IN ('team_invite', 'team_update', 'team_removed', 'alert', 'announcement')),
  CONSTRAINT valid_notification_status CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'read'))
);

-- Add status column to team_members if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE team_members ADD COLUMN status text NOT NULL DEFAULT 'active';
    ALTER TABLE team_members ADD CONSTRAINT valid_member_status CHECK (status IN ('invited', 'active'));
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR NOTIFICATIONS
-- ============================================

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- Policy: Users can update their own notifications (mark as read, accept/decline)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Policy: Restaurant owners can create notifications for their employees
CREATE POLICY "Owners can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- For team invites, ensure sender owns the restaurant
      (type = 'team_invite' AND team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM teams
        JOIN restaurants ON restaurants.id = teams.restaurant_id
        WHERE teams.id = team_id
        AND restaurants.owner_id = auth.uid()
      ))
      OR
      -- For other notification types, add checks as needed
      type IN ('alert', 'announcement')
    )
  );

-- Policy: Senders can view notifications they created
CREATE POLICY "Senders can view sent notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_team_id ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Composite index for common query pattern (recipient + unread)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON notifications(recipient_id, created_at DESC) 
  WHERE read_at IS NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get unread notification count for current user
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
  AND status = 'pending';
  
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
  v_restaurant_name text;
  v_sender_name text;
  v_notification_id uuid;
BEGIN
  -- Get team and restaurant names
  SELECT teams.name, restaurants.name, profiles.name
  INTO v_team_name, v_restaurant_name, v_sender_name
  FROM teams
  JOIN restaurants ON restaurants.id = teams.restaurant_id
  JOIN profiles ON profiles.id = auth.uid()
  WHERE teams.id = p_team_id;

  -- Create notification
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
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION create_team_invite_notification(uuid, uuid, text) TO authenticated;