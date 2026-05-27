'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase/client'

export function useUser(): { user: User | null; isLoading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, isLoading }
}
