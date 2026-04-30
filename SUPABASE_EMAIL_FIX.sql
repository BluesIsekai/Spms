
-- OPTION 1: Confirm all existing users (for development/testing)
-- This marks all users as email-confirmed so they can login freely
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- OPTION 2: Disable Email Confirmation Requirement
-- Go to: Supabase Dashboard → Authentication → Providers → Email
-- Toggle OFF: "Confirm email" 
-- Then click Save
--
-- This prevents the "Email not confirmed" error on repeat logins

-- OPTION 3: For a specific user, confirm their email:
-- UPDATE auth.users
-- SET email_confirmed_at = NOW()
-- WHERE email = 'user@example.com';
