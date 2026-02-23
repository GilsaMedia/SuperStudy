import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  uid: string;
  role: 'teacher' | 'student';
  fullName?: string;
  email?: string;
  /** @deprecated Use subjects for teachers. Kept for backward compatibility. */
  subject?: string;
  /** Teacher's subjects (multiple). Legacy profiles may only have subject. */
  subjects?: string[];
  points?: string;
  location?: string;
  rules?: string;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'superstudy_user_profile';
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });
    // If auth doesn't resolve within 8s (e.g. no network), show app anyway so user can try login
    const t = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(t);
      unsub();
    };
  }, []);

  const fetchProfile = useCallback(async (skipCache = false) => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      try {
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
      } catch {}
      return;
    }

    let cacheApplied = false;
    if (!skipCache) {
      try {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const parsed: UserProfile = JSON.parse(cached);
          if (parsed?.uid === user.uid) {
            setProfile(parsed);
            cacheApplied = true;
          }
        }
      } catch {}
    }

    setProfileLoading(!cacheApplied);
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const subjects = Array.isArray(data.subjects)
          ? data.subjects
          : data.subject
            ? [data.subject]
            : undefined;
        const next: UserProfile = {
          uid: user.uid,
          role: data.role || 'student',
          fullName: data.fullName,
          email: data.email,
          subject: data.subject,
          subjects,
          points: data.points,
          location: data.location,
          rules: data.rules,
        };
        setProfile(next);
        await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next));
      } else {
        // New Google (or other IdP) user: create default student profile so they can use the app
        const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
        if (isGoogle) {
          const defaultProfile: UserProfile = {
            uid: user.uid,
            role: 'student',
            fullName: user.displayName || undefined,
            email: user.email || undefined,
          };
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email ?? null,
            fullName: user.displayName ?? null,
            role: 'student',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            providerId: 'google.com',
            app: { onboardingComplete: false, theme: 'dark' },
          }, { merge: true });
          setProfile(defaultProfile);
          await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(defaultProfile));
        } else {
          setProfile(null);
          await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
        }
      }
    } catch (err) {
      try {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const parsed: UserProfile = JSON.parse(cached);
          if (parsed?.uid === user.uid) setProfile(parsed);
          else setProfile(null);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      }
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile(true);
  }, [fetchProfile]);

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading: loading || profileLoading,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useFirebaseAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useFirebaseAuth must be used within FirebaseAuthProvider');
  return ctx;
};
