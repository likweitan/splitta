import React, { createContext, useContext, useEffect, useState } from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "../pocketbase";

interface AuthContextType {
  session: RecordModel | null;
  user: RecordModel | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    if (pb.authStore.isValid) {
      setUser(pb.authStore.record);
    }
    setLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(record);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    pb.authStore.clear();
  };

  const session = user; // In PocketBase, if user exists the session is valid

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
