import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';

interface UserProfile {
  uid: string;
  role: 'teacher' | 'student';
  fullName?: string;
  email?: string;
  subject?: string;
  points?: string;
  location?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'superstudy_user_profile';

const initialProfileState = {
  profile: null as UserProfile | null,
  profileLoading: true,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfileState.profile);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(initialProfileState.profileLoading);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        try {
          window.localStorage.removeItem(PROFILE_CACHE_KEY);
        } catch {}
        return;
      }

      // Load cached profile immediately if available (helps offline scenarios)
      if (!profile) {
        try {
          const cached = window.localStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            const parsed: UserProfile = JSON.parse(cached);
            if (parsed?.uid === user.uid) {
              setProfile(parsed);
            }
          }
        } catch {}
      }

      setProfileLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (active) {
            setProfile({
              uid: user.uid,
              role: data.role || 'student',
              fullName: data.fullName,
              email: data.email,
              subject: data.subject,
              points: data.points,
              location: data.location,
            });
            try {
              window.localStorage.setItem(
                PROFILE_CACHE_KEY,
                JSON.stringify({
                  uid: user.uid,
                  role: data.role || 'student',
                  fullName: data.fullName,
                  email: data.email,
                  subject: data.subject,
                  points: data.points,
                  location: data.location,
                } satisfies UserProfile),
              );
            } catch {}
          }
        } else if (active) {
          setProfile(null);
          try {
            window.localStorage.removeItem(PROFILE_CACHE_KEY);
          } catch {}
        }
      } catch (err) {
        if (active) {
          // eslint-disable-next-line no-console
          console.warn('Failed to load profile. Falling back to auth user only.', err);
          try {
            const cached = window.localStorage.getItem(PROFILE_CACHE_KEY);
            if (cached) {
              const parsed: UserProfile = JSON.parse(cached);
              if (parsed?.uid === user.uid) {
                setProfile(parsed);
              } else {
                setProfile(null);
              }
            } else {
              setProfile(null);
            }
          } catch {
            setProfile(null);
          }
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    void fetchProfile();

    return () => {
      active = false;
    };
  }, [user]);

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading: loading || profileLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useFirebaseAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  return ctx;
};

export const ProtectedRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading } = useFirebaseAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const StudentRoute: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useFirebaseAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role !== 'student') return <Navigate to="/" replace />;
  return <>{children}</>;
};

