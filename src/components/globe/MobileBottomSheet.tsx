'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import RightPanel from './RightPanel'

export default function MobileBottomSheet() {
  const searchParams = useSearchParams()
  const toCountry = searchParams.get('toCountry')
  const [expanded, setExpanded] = useState(false)

  // Touch drag state
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const dragStartExpanded = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragStartExpanded.current = expanded
  }, [expanded])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const delta = dragStartY.current - e.changedTouches[0].clientY
    if (Math.abs(delta) > 40) {
      setExpanded(delta > 0) // swipe up = expand, down = collapse
    }
    dragStartY.current = null
  }, [])

  const collapsedHeight = toCountry ? 'h-[30vh]' : 'h-[56px]'
  const sheetHeight = expanded ? 'h-[92vh]' : collapsedHeight

  return (
    <div
      ref={sheetRef}
      className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] z-20 flex flex-col transition-[height] duration-300 ease-out ${sheetHeight}`}
    >
      {/* Handle bar — tap to toggle, drag to resize */}
      <div
        className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-8 h-1 rounded-full bg-gray-300" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {toCountry ? (
          <RightPanel />
        ) : (
          <div className="flex items-center justify-center h-full gap-2 text-sm text-gray-400 px-4">
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
            Tap a country to explore flights
          </div>
        )}
      </div>
    </div>
  )
}
