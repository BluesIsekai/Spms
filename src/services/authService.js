import { supabase } from './supabaseClient';

/**
 * Create user profile in public.users table (backup if trigger fails)
 */
export async function createUserProfile(userId, email, fullName) {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    const { error } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          name: fullName || email,
        },
      ])
      .select();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = duplicate key, which is fine (already exists)
      console.error('CreateUserProfile error:', error);
    }
  } catch (error) {
    console.error('CreateUserProfile error:', error);
    // Don't throw - this is just a backup
  }
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(email, password, fullName) {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName,
        },
      },
    });

    // Handle duplicate user error
    if (authError?.message?.includes('User already registered')) {
      const err = new Error(
        'This email is already registered. Please login instead or use password reset if you forgot your password.'
      );
      err.code = 'USER_EXISTS';
      throw err;
    }

    if (authError) throw authError;

    // Backup: Create user profile (trigger should handle this, but backup just in case)
    if (authData.user) {
      await createUserProfile(authData.user.id, email, fullName);
    }

    return {
      user: authData.user,
      session: authData.session,
    };
  } catch (error) {
    console.error('SignUp error:', error);
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return {
      user: data.user,
      session: data.session,
    };
  } catch (error) {
    console.error('SignIn error:', error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('SignOut error:', error);
    throw error;
  }
}

/**
 * Get the current session
 */
export async function getSession() {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('GetSession error:', error);
    return null;
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('GetCurrentUser error:', error);
    return null;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback) {
  if (!supabase) return () => {};

  try {
    const { data } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(session, event);
      }
    );

    // Return unsubscribe function
    return () => {
      if (data && data.subscription) {
        data.subscription.unsubscribe();
      }
    };
  } catch (error) {
    console.error('OnAuthStateChange error:', error);
    return () => {};
  }
}

/**
 * Send password reset email
 */
export async function resetPasswordEmail(email) {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  } catch (error) {
    console.error('ResetPasswordEmail error:', error);
    throw error;
  }
}

/**
 * Update password with token
 */
export async function updatePassword(newPassword) {
  if (!supabase) throw new Error('Supabase not configured');

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  } catch (error) {
    console.error('UpdatePassword error:', error);
    throw error;
  }
}
