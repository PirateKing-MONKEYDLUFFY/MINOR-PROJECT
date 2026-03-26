-- Create user role enum
CREATE TYPE public.user_role AS ENUM ('elder', 'caregiver');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'elder',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create family connections (caregiver <-> elder relationship)
CREATE TABLE public.family_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  elder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'family', -- 'son', 'daughter', 'spouse', etc.
  is_primary_contact BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(caregiver_id, elder_id)
);

-- Create emergency contacts
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medicines table
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'daily', 'twice_daily', 'weekly', etc.
  times TEXT[] NOT NULL, -- Array of times like ['08:00', '20:00']
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create medicine logs (tracking when medicines are taken)
CREATE TABLE public.medicine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID REFERENCES public.medicines(id) ON DELETE CASCADE NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'taken', 'skipped', 'pending', 'missed'
  taken_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create consultations table (real conversation history)
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  specialist_id TEXT NOT NULL,
  specialist_name TEXT NOT NULL,
  summary TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Helper function to get profile ID from auth user
CREATE OR REPLACE FUNCTION public.get_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Helper function to check if user is caregiver of an elder
CREATE OR REPLACE FUNCTION public.is_caregiver_of(_caregiver_user_id UUID, _elder_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_connections fc
    JOIN public.profiles p ON p.id = fc.caregiver_id
    WHERE p.user_id = _caregiver_user_id
    AND fc.elder_id = _elder_profile_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Caregivers can view connected elders"
ON public.profiles FOR SELECT
USING (
  public.is_caregiver_of(auth.uid(), id)
);

-- Family connections policies
CREATE POLICY "Users can view own family connections"
ON public.family_connections FOR SELECT
USING (
  caregiver_id = public.get_profile_id(auth.uid()) OR
  elder_id = public.get_profile_id(auth.uid())
);

CREATE POLICY "Caregivers can create connections"
ON public.family_connections FOR INSERT
WITH CHECK (caregiver_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Users can delete own connections"
ON public.family_connections FOR DELETE
USING (
  caregiver_id = public.get_profile_id(auth.uid()) OR
  elder_id = public.get_profile_id(auth.uid())
);

-- Emergency contacts policies
CREATE POLICY "Elders can manage own emergency contacts"
ON public.emergency_contacts FOR ALL
USING (elder_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can view elder emergency contacts"
ON public.emergency_contacts FOR SELECT
USING (public.is_caregiver_of(auth.uid(), elder_id));

CREATE POLICY "Caregivers can manage elder emergency contacts"
ON public.emergency_contacts FOR INSERT
WITH CHECK (public.is_caregiver_of(auth.uid(), elder_id));

CREATE POLICY "Caregivers can update elder emergency contacts"
ON public.emergency_contacts FOR UPDATE
USING (public.is_caregiver_of(auth.uid(), elder_id));

-- Medicines policies
CREATE POLICY "Elders can view own medicines"
ON public.medicines FOR SELECT
USING (elder_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can view elder medicines"
ON public.medicines FOR SELECT
USING (public.is_caregiver_of(auth.uid(), elder_id));

CREATE POLICY "Elders can manage own medicines"
ON public.medicines FOR INSERT
WITH CHECK (elder_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can manage elder medicines"
ON public.medicines FOR INSERT
WITH CHECK (public.is_caregiver_of(auth.uid(), elder_id));

CREATE POLICY "Elders can update own medicines"
ON public.medicines FOR UPDATE
USING (elder_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can update elder medicines"
ON public.medicines FOR UPDATE
USING (public.is_caregiver_of(auth.uid(), elder_id));

-- Medicine logs policies
CREATE POLICY "Users can view medicine logs"
ON public.medicine_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.medicines m
    WHERE m.id = medicine_id
    AND (m.elder_id = public.get_profile_id(auth.uid()) OR public.is_caregiver_of(auth.uid(), m.elder_id))
  )
);

CREATE POLICY "Users can manage medicine logs"
ON public.medicine_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.medicines m
    WHERE m.id = medicine_id
    AND (m.elder_id = public.get_profile_id(auth.uid()) OR public.is_caregiver_of(auth.uid(), m.elder_id))
  )
);

CREATE POLICY "Users can update medicine logs"
ON public.medicine_logs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.medicines m
    WHERE m.id = medicine_id
    AND (m.elder_id = public.get_profile_id(auth.uid()) OR public.is_caregiver_of(auth.uid(), m.elder_id))
  )
);

-- Consultations policies
CREATE POLICY "Elders can manage own consultations"
ON public.consultations FOR ALL
USING (elder_id = public.get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can view elder consultations"
ON public.consultations FOR SELECT
USING (public.is_caregiver_of(auth.uid(), elder_id));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_medicines_updated_at
BEFORE UPDATE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_consultations_updated_at
BEFORE UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();