import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export interface User {
  id: string;
  email: string | null;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id, currentUser.email);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid: string, emailFromSession?: string | null) {
    try {
      const currentEmail = (emailFromSession || user?.email || '').toLowerCase().trim();
      const isSystemAdminEmail = ['raoniespin@gmail.com', 'raopniespin@gmail.com', 'espin.mais@gmail.com'].includes(currentEmail);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (!error && data) {
        // Robust role handling: ensure string, trim, and handle nulls
        const rawRole = data.role || 'Customer';
        let cleanedRole = rawRole.toString().trim();
        let approved = !!data.is_approved;
        
        const profileEmail = (data.email || '').toLowerCase().trim();
        const absoluteAdmin = isSystemAdminEmail || ['raoniespin@gmail.com', 'raopniespin@gmail.com', 'espin.mais@gmail.com'].includes(profileEmail);

        if (absoluteAdmin) {
          cleanedRole = 'Admin';
          approved = true;
          // Sync with DB if out of date
          if (data.role !== 'Admin' || !data.is_approved) {
            await supabase.from('profiles').update({ role: 'Admin', is_approved: true }).eq('id', uid);
          }
        }
        
        console.log(`[AuthSync] User: ${data.email || currentEmail}, DB Role: "${rawRole}", Final Role: "${cleanedRole}"`);
        
        setProfile({
          ...data,
          role: cleanedRole as any,
          is_approved: approved
        } as Profile);
      } else {
        // Profile not found or error occurred
        if (isSystemAdminEmail) {
          // Auto-create/restore profile for admin email to make sure they can ALWAYS log in happily even if DB was reset
          const backupProfile = {
            id: uid,
            full_name: 'RAONIESPIN',
            email: currentEmail,
            role: 'Admin',
            is_approved: true,
            avatar_url: null,
            created_at: new Date().toISOString()
          };
          await supabase.from('profiles').insert(backupProfile);
          setProfile(backupProfile as any);
        } else {
          console.error('[AuthError / ProfileNotFound] Resetting profile state.', error);
          setProfile(null);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// forced sync
