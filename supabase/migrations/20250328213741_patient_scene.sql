/*
  # Create admin user

  1. Changes
    - Insert admin user with email admin@gmail.com if it doesn't exist
    - Set admin flag to true in profiles table
    - Handle existing profile gracefully
    
  2. Security
    - Uses secure password hashing through auth.users
    - Maintains existing RLS policies
*/

-- Create admin user
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_uid
  FROM auth.users
  WHERE email = 'admin@gmail.com';

  -- If admin user doesn't exist, create it
  IF admin_uid IS NULL THEN
    -- Insert into auth.users
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@gmail.com',
      crypt('adminadmin', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin User"}',
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO admin_uid;

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      admin_uid,
      format('{"sub":"%s","email":"%s"}', admin_uid::text, 'admin@gmail.com')::jsonb,
      'email',
      admin_uid::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  -- Update or insert profile
  INSERT INTO public.profiles (id, is_admin, created_at, updated_at)
  VALUES (admin_uid, true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET is_admin = true,
        updated_at = NOW();
END $$;