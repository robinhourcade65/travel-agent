'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { updatePassword } from '@/app/actions/auth'
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

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  const isExpiredError =
    state?.error?.toLowerCase().includes('expired') ||
    state?.error?.toLowerCase().includes('link')

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>Pick something you haven&apos;t used before.</CardDescription>
      </CardHeader>

      <form action={action}>
        <CardContent className="space-y-4">
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {state.error}
                {isExpiredError && (
                  <>
                    {' '}
                    <Link
                      href="/forgot-password"
                      className="underline font-medium whitespace-nowrap"
                    >
                      Request a new link
                    </Link>
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 10 characters"
              required
            />
            {state?.fieldErrors?.password && (
              <p className="text-sm text-destructive">{state.fieldErrors.password[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
            {state?.fieldErrors?.confirmPassword && (
              <p className="text-sm text-destructive">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Saving…' : 'Set new password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
