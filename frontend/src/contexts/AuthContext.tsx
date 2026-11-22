import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

const RETURN_TO_KEY = "splitta:returnTo";

/** Reads and clears the in-app path to resume after the IAS login round trip. */
// eslint-disable-next-line react-refresh/only-export-components
export function consumeReturnTo(): string {
  const path = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  // Only allow same-origin app paths to avoid open redirects.
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/";
}

interface AuthContextType {
  session: AuthUser | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signIn: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    setError(null);
    const response = await fetch("/odata/v4/receipt/whoAmI()", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    if (response.status === 401 || response.status === 403) {
      setUser(null);
      return null;
    }

    if (!response.ok) {
      throw new Error(`Unable to verify your sign-in (${response.status}).`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      setUser(null);
      return null;
    }

    const result = await response.json();
    const profile = result.value ?? result;
    const currentUser: AuthUser = {
      id: profile.ID,
      name: profile.displayName || profile.ID,
      email: profile.email || "",
    };
    setUser(currentUser);
    return currentUser;
  }, []);

  useEffect(() => {
    refreshUser()
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Unable to verify sign-in.",
        );
      })
      .finally(() => setLoading(false));
  }, [refreshUser]);

  const signIn = async (returnTo?: string) => {
    if (import.meta.env.DEV) {
      setLoading(true);
      try {
        await refreshUser();
      } finally {
        setLoading(false);
      }
      return;
    }

    if (returnTo) sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    window.location.assign("/auth/login");
  };

  const signOut = async () => {
    if (import.meta.env.DEV) {
      setUser(null);
      return;
    }

    window.location.assign("/logout");
  };

  return (
    <AuthContext.Provider
      value={{
        session: user,
        user,
        loading,
        error,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
