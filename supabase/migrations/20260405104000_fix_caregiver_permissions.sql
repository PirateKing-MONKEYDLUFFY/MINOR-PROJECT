
-- 0. Profiles: Make user_id nullable to allow managed elder profiles
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- 1. Profiles: Allow caregivers to INSERT elder profiles (where user_id is null)
DROP POLICY IF EXISTS "Caregivers can insert elder profiles" ON public.profiles;
CREATE POLICY "Caregivers can insert elder profiles"
ON public.profiles FOR INSERT
WITH CHECK (
  (role = 'elder' AND user_id IS NULL) OR 
  (auth.uid() = user_id)
);

-- 2. Profiles: Allow caregivers to UPDATE connected elders
DROP POLICY IF EXISTS "Caregivers can update connected elders" ON public.profiles;
CREATE POLICY "Caregivers can update connected elders"
ON public.profiles FOR UPDATE
USING (
  public.is_caregiver_of(auth.uid(), id)
);

-- 3. Profiles: Allow caregivers to DELETE connected elders
DROP POLICY IF EXISTS "Caregivers can delete connected elders" ON public.profiles;
CREATE POLICY "Caregivers can delete connected elders"
ON public.profiles FOR DELETE
USING (
  public.is_caregiver_of(auth.uid(), id)
);

-- 4. Family Connections: Allow caregivers to DELETE connections
-- (Existing "Users can delete own connections" should cover it, but let's be explicit)
DROP POLICY IF EXISTS "Caregivers can manage family connections" ON public.family_connections;
CREATE POLICY "Caregivers can manage family connections"
ON public.family_connections FOR ALL
USING (
  caregiver_id = public.get_profile_id(auth.uid()) OR
  elder_id = public.get_profile_id(auth.uid())
)
WITH CHECK (
  caregiver_id = public.get_profile_id(auth.uid()) OR
  elder_id = public.get_profile_id(auth.uid())
);

-- 5. Ensure any Caregiver can SELECT any Elder profile that has NO user_id (optional, for lookup)
-- Actually, stick to is_caregiver_of for security.
