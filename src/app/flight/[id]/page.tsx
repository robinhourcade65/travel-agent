import Link from 'next/link'

export default async function FlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <div className="bg-white rounded-2xl shadow-md border border-[#E5E7EB] p-8 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <h1 className="text-base font-semibold text-gray-900 mb-1">Booking link unavailable</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          We don&apos;t have a direct booking link for flight{' '}
          <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{id}</code>.
          Try searching directly on the airline&apos;s website.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 bg-[#2B5BE0] text-white text-sm font-semibold rounded-lg hover:bg-[#2348C0] transition"
        >
          Back to globe
        </Link>
      </div>
    </main>
  )
}
