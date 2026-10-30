import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, isQuotaOrOfflineError, readLocalCache, writeLocalCache, runFirestoreOp } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  if (!isQuotaOrOfflineError(error)) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  // We throw the JSON string as required by the skill
  throw new Error(JSON.stringify(errInfo));
}


export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'visitor';
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  schoolId?: string;
  createdAt: any;
  updatedAt: any;
}

const googleProvider = new GoogleAuthProvider();

// Access token is now stored in memory to comply with security guidelines
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const getCurrentUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  const cacheKey = `shafa_user_${uid}`;
  const docRef = doc(db, 'users', uid);

  try {
    const docSnap = await runFirestoreOp(() => getDoc(docRef));
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      writeLocalCache(cacheKey, profile);
      return profile;
    }
    return null;
  } catch (error) {
    try {
      const cachedSnap = await getDocFromCache(docRef);
      if (cachedSnap.exists()) {
        const profile = cachedSnap.data() as UserProfile;
        writeLocalCache(cacheKey, profile);
        return profile;
      }
    } catch {
      // Ignore cache miss
    }

    const localProfile = readLocalCache<UserProfile | null>(cacheKey, null);
    if (localProfile) {
      return localProfile;
    }

    if (isQuotaOrOfflineError(error)) {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === uid) {
        const isBootstrappedAdmin =
          currentUser.email === 's8waeel@gmail.com' ||
          currentUser.email === 'admin@shafa.edu.sa';
        const fallbackProfile: UserProfile = {
          uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || (isBootstrappedAdmin ? 'مدير النظام' : 'مستخدم'),
          role: isBootstrappedAdmin ? 'owner' : 'member',
          status: 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        writeLocalCache(cacheKey, fallbackProfile);
        return fallbackProfile;
      }
      return null;
    }

    return handleFirestoreError(error, OperationType.GET, path);
  }
};

export const registerUser = async (email: string, pass: string, displayName: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;
  
  const isBootstrappedAdmin = email === 's8waeel@gmail.com' || email === 'admin@shafa.edu.sa';

  const localProfile: UserProfile = {
    uid: user.uid,
    email: email,
    displayName: displayName,
    role: isBootstrappedAdmin ? 'owner' : 'visitor',
    status: isBootstrappedAdmin ? 'approved' : 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeLocalCache(`shafa_user_${user.uid}`, localProfile);
  const allUsers = readLocalCache<UserProfile[]>('shafa_all_users', []);
  writeLocalCache('shafa_all_users', [localProfile, ...allUsers.filter(u => u.uid !== user.uid)]);

  try {
    await runFirestoreOp(() =>
      setDoc(doc(db, 'users', user.uid), {
        ...localProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  } catch {
    // Saved in local cache if Firestore write quota is exceeded
  }
  return user;
};

export const loginUser = async (email: string, pass: string) => {
  return await signInWithEmailAndPassword(auth, email, pass);
};

export const googleSignIn = async () => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    
    // Create/update profile on first login
    try {
      const profile = await getCurrentUserProfile(result.user.uid);
      const isBootstrappedAdmin = result.user.email === 's8waeel@gmail.com' || result.user.email === 'admin@shafa.edu.sa';
      
      if (!profile) {
        const newProfile: UserProfile = {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'مستخدم جوجل',
          role: isBootstrappedAdmin ? 'owner' : 'visitor',
          status: isBootstrappedAdmin ? 'approved' : 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        writeLocalCache(`shafa_user_${result.user.uid}`, newProfile);
        await runFirestoreOp(() =>
          setDoc(doc(db, 'users', result.user.uid), {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } else if (isBootstrappedAdmin && profile.role !== 'owner') {
        const updatedProfile: UserProfile = {
          ...profile,
          role: 'owner',
          status: 'approved',
          updatedAt: new Date().toISOString(),
        };
        writeLocalCache(`shafa_user_${result.user.uid}`, updatedProfile);
        await runFirestoreOp(() =>
          updateDoc(doc(db, 'users', result.user.uid), {
            role: 'owner',
            status: 'approved',
            updatedAt: serverTimestamp()
          })
        );
      }
    } catch {
      // Ignore profile write error when quota is exceeded
    }
    
    return result.user;
  } catch (error) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};


export const getAccessToken = () => cachedAccessToken;

export const logoutUser = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const resetPassword = async (email: string) => {
  return await sendPasswordResetEmail(auth, email);
};

// Listener to clear token on logout
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});
