import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Welcome to Travel Agent</h1>
      <p className="text-muted-foreground max-w-sm">
        Your account is confirmed. The globe and alerts are coming soon.
      </p>
      <div className="flex gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: 'default' }))}>
          Go to homepage
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}
