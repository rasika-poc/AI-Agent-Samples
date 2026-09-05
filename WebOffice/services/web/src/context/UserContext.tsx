import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { CurrentUserOut, getMe } from "../api";
import { getToken } from "../auth";

interface UserContextValue {
  user: CurrentUserOut | null;
  refresh: () => void;
  clear: () => void;
}

const UserContext = createContext<UserContextValue>({ user: null, refresh: () => {}, clear: () => {} });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUserOut | null>(null);

  const refresh = useCallback(() => {
    if (!getToken()) {
      setUser(null);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <UserContext.Provider value={{ user, refresh, clear: () => setUser(null) }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}
