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
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>The link expires in 24 hours. Check your spam folder if you don&apos;t see it.</p>
        <p>
          Wrong email?{' '}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Sign up again
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
