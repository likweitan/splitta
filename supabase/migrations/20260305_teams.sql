-- ============================================================
-- Teams feature migration
-- Creates: teams, team_members, team_invites tables
-- Adds: team_id column to receipts
-- ============================================================

-- 1. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Team members (join table)
CREATE TYPE team_role AS ENUM ('owner', 'member');

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 3. Team invites (email-based)
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, invited_email)
);

-- 4. Add team_id to receipts (nullable — personal receipts have no team)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Teams: visible to members
CREATE POLICY "Users can view teams they belong to"
  ON teams FOR SELECT
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Teams: only authenticated users can create
CREATE POLICY "Authenticated users can create teams"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Teams: only owner can update
CREATE POLICY "Team owner can update team"
  ON teams FOR UPDATE
  USING (owner_id = auth.uid());

-- Teams: only owner can delete
CREATE POLICY "Team owner can delete team"
  ON teams FOR DELETE
  USING (owner_id = auth.uid());

-- Team members: visible to fellow team members
CREATE POLICY "Team members can view other members"
  ON team_members FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Team members: owner can add members
CREATE POLICY "Team owner can add members"
  ON team_members FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Team members: owner can remove members, or member can leave
CREATE POLICY "Team owner can remove members or self-leave"
  ON team_members FOR DELETE
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Team invites: visible to team owner and the invited user
CREATE POLICY "Team owner and invited user can view invites"
  ON team_invites FOR SELECT
  USING (
    invited_by = auth.uid()
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team invites: team owner can create invites
CREATE POLICY "Team owner can create invites"
  ON team_invites FOR INSERT
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team invites: invited user or team owner can update (accept/decline)
CREATE POLICY "Invited user or team owner can update invite"
  ON team_invites FOR UPDATE
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team invites: team owner can delete invites
CREATE POLICY "Team owner can delete invites"
  ON team_invites FOR DELETE
  USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Update receipts policy: team members can view team receipts
CREATE POLICY "Team members can view team receipts"
  ON receipts FOR SELECT
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_receipts_team_id ON receipts(team_id);
