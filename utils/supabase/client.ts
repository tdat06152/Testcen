'use client';

import { createBrowserClient } from '@supabase/ssr';

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.com';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'example';

  try {
    return createBrowserClient(url, key);
  } catch (e) {
    console.warn('Failed to create Supabase client', e);
    // Fallback for build time if absolutely necessary, though the strings above should prevent the "required" error.
    throw e;
  }
};