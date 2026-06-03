'use client'

import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'

const GlobeInner = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#FAFAFA]">
      <div className="w-10 h-10 border-[3px] border-[#2B5BE0] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Loading flight prices…</p>
    </div>
  ),
})

export default function GlobeWrapper() {
  const searchParams = useSearchParams()
  const origin = searchParams.get('from') ?? 'DUB'
  return <GlobeInner origin={origin} />
}
