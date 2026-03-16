
-- Create wellness_checkins table for daily mood/health tracking
CREATE TABLE public.wellness_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  elder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mood TEXT NOT NULL,
  notes TEXT,
  symptoms TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wellness_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elders can manage own checkins"
ON public.wellness_checkins FOR ALL
USING (elder_id = get_profile_id(auth.uid()));

CREATE POLICY "Caregivers can view elder checkins"
ON public.wellness_checkins FOR SELECT
USING (is_caregiver_of(auth.uid(), elder_id));
