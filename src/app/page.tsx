import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-background text-foreground gap-6">
      <h1 className="text-4xl font-bold tracking-tight">Travel Agent</h1>
      <p className="text-muted-foreground text-lg">Coming soon.</p>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </main>
  )
}
