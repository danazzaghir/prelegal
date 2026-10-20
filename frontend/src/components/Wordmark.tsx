/** The Prelegal name, with "legal" in the accent yellow. */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      Pre<span className="text-[#ecad0a]">legal</span>
    </span>
  );
}
