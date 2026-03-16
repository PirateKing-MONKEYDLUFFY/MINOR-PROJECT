-- Allow multiple profiles (elder/caregiver) for a single account architecture
-- or allow elder profiles without a formal user_id (managed by caregiver)

-- 1. Remove strict UNIQUE constraint on user_id in profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;

-- 2. Make user_id nullable
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- 3. Update Profiles RLS to allow caregivers to manage elders
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) OR 
  (auth.uid() IS NOT NULL AND role = 'elder' AND user_id IS NULL)
);

-- 4. Enable caregivers to update elders they are connected to
DROP POLICY IF EXISTS "Caregivers can update connected elders" ON public.profiles;
CREATE POLICY "Caregivers can update connected elders"
ON public.profiles FOR UPDATE
USING (public.is_caregiver_of(auth.uid(), id));

-- 5. Ensure caregivers can view connected elders even if user_id is null
DROP POLICY IF EXISTS "Caregivers can view connected elders" ON public.profiles;
CREATE POLICY "Caregivers can view connected elders"
ON public.profiles FOR SELECT
USING (
  public.is_caregiver_of(auth.uid(), id)
);
