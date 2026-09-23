import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

export function signUpEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function logInEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logOut(): Promise<void> {
  return signOut(auth);
}

/** Email/password accounts must confirm their address. Google accounts are already verified. */
export function needsEmailVerification(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  const usesPassword = user.providerData?.some((p) => p.providerId === 'password');
  return Boolean(usesPassword) && !user.emailVerified;
}

export function sendVerificationEmail(user: User): Promise<void> {
  return sendEmailVerification(user);
}

export function sendPasswordReset(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email.trim());
}
