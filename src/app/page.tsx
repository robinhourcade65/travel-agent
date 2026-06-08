import { connection } from 'next/server'
import { Suspense } from 'react'
import LeftPanel from '@/components/globe/LeftPanel'
import GlobeWrapper from '@/components/globe/GlobeWrapper'
import RightPanel from '@/components/globe/RightPanel'
import MobileBottomSheet from '@/components/globe/MobileBottomSheet'

function PanelSkeleton() {
  return <div className="w-full h-full bg-white animate-pulse" />
}

function GlobeSkeleton() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#FAFAFA]">
      <div className="w-10 h-10 border-[3px] border-[#2B5BE0] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading flight prices…</p>
    </div>
  )
}

export default async function Page() {
  await connection()

  return (
    <main className="flex flex-col md:flex-row h-screen overflow-hidden bg-[#FAFAFA]">
      {/* Left panel — origin, dates, flex chips */}
      <aside className="md:w-72 md:flex-shrink-0 md:border-r border-b md:border-b-0 border-[#E5E7EB] bg-white md:overflow-y-auto flex-shrink-0">
        <Suspense fallback={<PanelSkeleton />}>
          <LeftPanel />
        </Suspense>
      </aside>

      {/* Globe — fills remaining space; bottom padding on mobile for the sheet */}
      <div className="flex-1 min-h-0 relative pb-14 md:pb-0">
        <Suspense fallback={<GlobeSkeleton />}>
          <GlobeWrapper />
        </Suspense>
      </div>

      {/* Right panel — desktop only */}
      <aside className="hidden md:flex md:w-80 md:flex-shrink-0 border-l border-[#E5E7EB] bg-white flex-col overflow-hidden">
        <Suspense fallback={<PanelSkeleton />}>
          <RightPanel />
        </Suspense>
      </aside>

      {/* Mobile bottom sheet */}
      <Suspense>
        <MobileBottomSheet />
      </Suspense>
    </main>
  )
}
