'use client';

import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.com',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example'
);