export function Wordmark({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  return (
    <span className={`wordmark wordmark-${size}`}>
      POW<span className="wordmark-now">NOW</span>
    </span>
  );
}
