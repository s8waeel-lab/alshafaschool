import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getCurrentUserProfile, UserProfile } from '../services/authService';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isMember: false,
  isOwner: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          const isBootstrappedAdmin = user.email === 's8waeel@gmail.com' || user.email === 'admin@shafa.edu.sa';
          let userProfile: UserProfile | null = null;

          try {
            userProfile = await getCurrentUserProfile(user.uid);
          } catch {
            // Handled via fallback below
          }
          
          if (isBootstrappedAdmin) {
            if (!userProfile || userProfile.role !== 'owner' || userProfile.status !== 'approved') {
              const fallbackOwnerProfile: UserProfile = {
                uid: user.uid,
                email: user.email!,
                displayName: userProfile?.displayName || user.displayName || 'مدير النظام',
                role: 'owner',
                status: 'approved',
                createdAt: userProfile?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              userProfile = fallbackOwnerProfile;
              try {
                const { writeLocalCache } = await import('../services/firebase');
                writeLocalCache(`shafa_user_${user.uid}`, fallbackOwnerProfile);
              } catch {
                // Ignore local cache error
              }
            }
          }
          
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'owner',
    isOwner: profile?.role === 'owner',
    isMember: (profile?.role === 'member' && profile?.status === 'approved') || profile?.role === 'admin' || profile?.role === 'owner',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
