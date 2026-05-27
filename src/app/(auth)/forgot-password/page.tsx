'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { forgotPassword } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined)
  const searchParams = useSearchParams()
  const isExpired = searchParams.get('error') === 'expired'

  const submitted = state !== undefined && !state?.error && !state?.fieldErrors

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>

      {submitted ? (
        <CardContent className="space-y-3 text-sm text-muted-foreground pb-6">
          <Alert>
            <AlertDescription>
              If an account exists for that email, you&apos;ll receive a reset link shortly.
              Check your spam folder if you don&apos;t see it.
            </AlertDescription>
          </Alert>
          <p className="text-center">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      ) : (
        <form action={action}>
          <CardContent className="space-y-4">
            {isExpired && (
              <Alert variant="destructive">
                <AlertDescription>
                  That link has expired or has already been used. Request a new one below.
                </AlertDescription>
              </Alert>
            )}

            {state?.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
              {state?.fieldErrors?.email && (
                <p className="text-sm text-destructive">{state.fieldErrors.email[0]}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Sending…' : 'Send reset link'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Remembered it?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Back to sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
