/*
  # Create Super Admin Account

  1. Changes
    - Create superadmin@mail.com account with password adminadmin
    - Add to admin email whitelist
    - Set admin flag in profiles
    - Update admin detection functions

  2. Security
    - Uses secure password hashing
    - Maintains existing RLS policies
    - Automatic admin flag assignment
*/

-- Function to check if email is admin (updated with new admin email)
CREATE OR REPLACE FUNCTION is_admin_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email IN (
    'admin@gmail.com',
    'peoplemetricssolutions@gmail.com',
    'michelle.gacigi@gmail.com',
    'superadmin@mail.com'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create super admin user
DO $$
DECLARE
  admin_uid uuid;
BEGIN
  -- Check if super admin user already exists
  SELECT id INTO admin_uid
  FROM auth.users
  WHERE email = 'superadmin@mail.com';

  -- If super admin user doesn't exist, create it
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
      'superadmin@mail.com',
      crypt('adminadmin', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin"}',
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
      format('{"sub":"%s","email":"%s"}', admin_uid::text, 'superadmin@mail.com')::jsonb,
      'email',
      admin_uid::text,
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Super admin account created with email: superadmin@mail.com';
  ELSE
    RAISE NOTICE 'Super admin account already exists';
  END IF;

  -- Update or insert profile with admin flag
  INSERT INTO public.profiles (id, is_admin, created_at, updated_at)
  VALUES (admin_uid, true, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET is_admin = true,
        updated_at = NOW();

  RAISE NOTICE 'Super admin profile updated with admin privileges';
END $$;

-- Update existing users to mark admin emails as admin (including new superadmin)
UPDATE profiles 
SET is_admin = true, updated_at = now()
WHERE id IN (
  SELECT u.id 
  FROM auth.users u 
  WHERE is_admin_email(u.email)
);

-- Log final admin count
DO $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count 
  FROM profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.is_admin = true;
  
  RAISE NOTICE 'Total admin users in system: %', admin_count;
  
  -- List all admin emails
  FOR admin_count IN 
    SELECT u.email
    FROM profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.is_admin = true
  LOOP
    RAISE NOTICE 'Admin user: %', admin_count;
  END LOOP;
END $$;