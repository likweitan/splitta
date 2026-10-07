import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { pb } from "../pocketbase";
import { useAuth } from "./AuthContext";
import type { Team } from "../types/teams";

interface TeamContextType {
  teams: Team[];
  activeTeam: Team | null;
  setActiveTeam: (team: Team) => void;
  loading: boolean;
  needsTeam: boolean;
  refetchTeams: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType>({
  teams: [],
  activeTeam: null,
  setActiveTeam: () => {},
  loading: true,
  needsTeam: false,
  refetchTeams: async () => {},
});

const ACTIVE_TEAM_KEY = "splitta_active_team_id";

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setActiveTeamState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const records = await pb.collection("team_members").getFullList({
        filter: `user_id = "${user.id}"`,
        expand: "team_id",
      });

      const teamList: Team[] = records
        .map((row) => row.expand?.team_id as unknown as Team)
        .filter(Boolean);
      setTeams(teamList);

      // Restore previously active team from localStorage, or auto-select first
      const savedTeamId = localStorage.getItem(ACTIVE_TEAM_KEY);
      if (savedTeamId) {
        const savedTeam = teamList.find((t) => t.id === savedTeamId);
        if (savedTeam) {
          setActiveTeamState(savedTeam);
        } else {
          localStorage.removeItem(ACTIVE_TEAM_KEY);
          if (teamList.length > 0) {
            setActiveTeamState(teamList[0]);
            localStorage.setItem(ACTIVE_TEAM_KEY, teamList[0].id);
          } else {
            setActiveTeamState(null);
          }
        }
      } else if (teamList.length > 0) {
        setActiveTeamState(teamList[0]);
        localStorage.setItem(ACTIVE_TEAM_KEY, teamList[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const needsTeam = !loading && teams.length === 0;

  const setActiveTeam = (team: Team) => {
    setActiveTeamState(team);
    localStorage.setItem(ACTIVE_TEAM_KEY, team.id);
  };

  return (
    <TeamContext.Provider
      value={{
        teams,
        activeTeam,
        setActiveTeam,
        loading,
        needsTeam,
        refetchTeams: fetchTeams,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTeam = () => useContext(TeamContext);
