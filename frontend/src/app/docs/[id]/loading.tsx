export default function Loading() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-8 w-8">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-8 w-8 bg-blue-500"></span>
        </div>
        <p className="text-gray-500 text-sm animate-pulse">Loading document...</p>
      </div>
    </div>
  );
}
