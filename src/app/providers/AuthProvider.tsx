import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "@/lib/firebase/client";
import type { AppUser } from "@/types";

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  firebaseUser: null,
  appUser: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      const snap = await getDoc(doc(db, "users", user.uid));
      const snapData = snap.exists() ? snap.data() : undefined;
      const data = snapData as AppUser | undefined;
      if (data && !data.isActive) {
        await auth.signOut();
        setFirebaseUser(null);
        setAppUser(null);
      } else {
        setAppUser(data ?? null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ firebaseUser, appUser, loading }),
    [firebaseUser, appUser, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
