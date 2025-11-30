import { supabase } from './supabase';

export interface SignUpData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  restaurant_id?: string;
  is_subscribed?: boolean;
  is_admin?: boolean;
  subscription_status?: string;
  stripe_customer_id?: string;
}

export const authService = {
  async signUp({ name, email, password }: SignUpData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) throw error;
    return data;
  },

  async login({ email, password }: LoginData) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, role, restaurant_id, is_subscribed, is_admin, subscription_status, stripe_customer_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);

        if (error.message.includes('recursion')) {
          console.error('Database recursion error detected. Using basic user data.');
        }

        return {
          id: user.id,
          email: user.email || '',
          name: 'User',
          role: 'none',
          restaurant_id: undefined,
        };
      }

      return {
        id: user.id,
        email: user.email || '',
        name: profile?.name || 'User',
        role: profile?.role || 'none',
        restaurant_id: profile?.restaurant_id || undefined,
        is_subscribed: profile?.is_subscribed || false,
        is_admin: profile?.is_admin || false,
        subscription_status: profile?.subscription_status || 'none',
        stripe_customer_id: profile?.stripe_customer_id || undefined,
      };
    } catch (error) {
      console.error('Unexpected error in getCurrentUser:', error);
      return null;
    }
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const user = await authService.getCurrentUser();
          callback(user);
        } else {
          callback(null);
        }
      })();
    });
  },
};
