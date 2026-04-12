-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Complete User Deletion SQL                                  ║
-- ║  Run this in Supabase Dashboard → SQL Editor                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- To completely remove a user, you MUST delete from auth.users
-- This will cascade delete from public.users automatically

-- Option 1: Delete specific user by email
DELETE FROM auth.users WHERE email = 'user@example.com';

-- Option 2: Delete all users (CAREFUL!)
-- DELETE FROM auth.users;

-- Option 3: Delete and verify
-- Before deleting, check who's registered:
SELECT id, email, email_confirmed_at FROM auth.users;

-- Then delete the ones you want:
-- DELETE FROM auth.users WHERE email = 'test@example.com';
