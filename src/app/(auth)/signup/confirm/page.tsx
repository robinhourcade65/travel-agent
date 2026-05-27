import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function SignupConfirmPage() {
  return (
    <Card className="shadow-sm text-center">
      <CardHeader className="space-y-1">
        <div className="text-4xl mb-2">✉️</div>
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to your inbox. Click it to activate your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>The link expires in 24 hours.</p>

        <hr className="border-border" />

        <div className="text-left space-y-2">
          <p className="font-medium text-foreground">What if I don&apos;t get the email?</p>
          <ul className="space-y-1.5">
            <li>Check your spam folder.</li>
            <li>
              You may already have an account —{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in instead →
              </Link>
            </li>
            <li>
              Wrong email?{' '}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Sign up again →
              </Link>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
