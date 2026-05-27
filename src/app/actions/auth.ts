'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

export type AuthFormState =
  | { error?: string; fieldErrors?: Record<string, string[]> }
  | undefined

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const signupSchema = z
  .object({
    email: z.email('Please enter a valid email address.'),
    password: z.string().min(10, 'Password must be at least 10 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

const signinSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  password: z.string().min(1, 'Please enter your password.'),
})

const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address.'),
})

const updatePasswordSchema = z
  .object({
    password: z.string().min(10, 'Password must be at least 10 characters.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}

function friendlyAuthError(message: string): string {
  if (message.toLowerCase().includes('invalid login credentials') ||
      message.toLowerCase().includes('invalid credentials') ||
      message.toLowerCase().includes('email not confirmed')) {
    return 'Invalid email or password.'
  }
  if (message.toLowerCase().includes('user already registered') ||
      message.toLowerCase().includes('already been registered')) {
    return 'An account with that email already exists. Try signing in.'
  }
  if (message.toLowerCase().includes('email rate limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = signupSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email, password } = parsed.data
  const origin = await getOrigin()
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) {
    return { error: friendlyAuthError(error.message) }
  }

  redirect('/signup/confirm')
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = signinSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email, password } = parsed.data
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: friendlyAuthError(error.message) }
  }

  redirect('/')
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function forgotPassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const raw = { email: formData.get('email') as string }

  const parsed = forgotPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email } = parsed.data
  const origin = await getOrigin()
  const supabase = await createServerClient()

  // Always return success to prevent email enumeration.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  return { error: undefined }
}

export async function updatePassword(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const raw = {
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = updatePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) {
    if (error.message.toLowerCase().includes('session') ||
        error.message.toLowerCase().includes('token') ||
        error.message.toLowerCase().includes('expired')) {
      return { error: 'This link has expired. Please request a new one.' }
    }
    return { error: 'Something went wrong. Please try again.' }
  }

  redirect('/')
}
