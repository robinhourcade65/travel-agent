import { connection } from 'next/server'
import { Suspense } from 'react'
import LeftPanel from '@/components/globe/LeftPanel'
import GlobeWrapper from '@/components/globe/GlobeWrapper'
import RightPanel from '@/components/globe/RightPanel'

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

      {/* Globe — fills remaining space */}
      <div className="flex-1 min-h-0 relative">
        <Suspense fallback={<GlobeSkeleton />}>
          <GlobeWrapper />
        </Suspense>
      </div>

      {/* Right panel — flight list placeholder (Phase B) */}
      <aside className="hidden md:block md:w-80 md:flex-shrink-0 border-l border-[#E5E7EB] bg-white">
        <RightPanel />
      </aside>

      {/* Mobile bottom sheet — right panel stub */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] py-4 z-20">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Select a country to see flights
        </div>
      </div>
    </main>
  )
}
