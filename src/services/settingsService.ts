import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface SystemSettings {
  driveFolderUrl: string;
  driveFolderName: string;
  updatedAt?: any;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  driveFolderUrl: '',
  driveFolderName: 'مجلد قوقل درايف المركزي - مجمع الشفا التعليمي',
};

export const getSystemSettings = async (): Promise<SystemSettings> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'general'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        driveFolderUrl: data.driveFolderUrl || '',
        driveFolderName: data.driveFolderName || DEFAULT_SETTINGS.driveFolderName,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error('Failed to fetch system settings:', err);
    return DEFAULT_SETTINGS;
  }
};

export const subscribeToSystemSettings = (callback: (settings: SystemSettings) => void) => {
  return onSnapshot(
    doc(db, 'settings', 'general'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          driveFolderUrl: data.driveFolderUrl || '',
          driveFolderName: data.driveFolderName || DEFAULT_SETTINGS.driveFolderName,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        });
      } else {
        callback(DEFAULT_SETTINGS);
      }
    },
    (err) => {
      console.error('Settings subscription error:', err);
      callback(DEFAULT_SETTINGS);
    }
  );
};

export const updateSystemSettings = async (
  settings: Pick<SystemSettings, 'driveFolderUrl' | 'driveFolderName'>,
  userId: string
): Promise<void> => {
  await setDoc(
    doc(db, 'settings', 'general'),
    {
      driveFolderUrl: settings.driveFolderUrl.trim(),
      driveFolderName: settings.driveFolderName.trim() || DEFAULT_SETTINGS.driveFolderName,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
