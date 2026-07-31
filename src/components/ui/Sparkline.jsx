export default function Sparkline({
  values = [],
  width = 96,
  height = 28,
  className = 'text-brand-500',
}) {
  const nums = values.map((v) => Number(v) || 0)
  if (nums.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />
  }
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const pad = 2
  const pts = nums
    .map((v, i) => {
      const x = pad + (i / (nums.length - 1)) * (width - pad * 2)
      const y = height - pad - ((v - min) / span) * (height - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  )
}
