'use client'

export default function RightPanel() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">Select a country to see flights</p>
      <p className="text-xs text-gray-400 max-w-[180px] leading-relaxed">
        Hover the globe to explore prices, then click a country to drill in.
      </p>
    </div>
  )
}
