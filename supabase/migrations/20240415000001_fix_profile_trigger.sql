-- Fix: Drop the automatic profile creation trigger
-- Profiles will be created by the app on first sign-in instead

-- Drop the trigger and function that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Also drop the watchlist seed trigger since it depends on profiles
DROP TRIGGER IF EXISTS on_profile_created_seed_watchlist ON profiles;
DROP FUNCTION IF EXISTS seed_default_watchlist();

-- Make the profiles table more flexible - allow null email initially
ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
