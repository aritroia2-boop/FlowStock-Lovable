-- Add missing description column to teams table
ALTER TABLE public.teams 
  ADD COLUMN IF NOT EXISTS description text;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_teams_description ON public.teams(description);