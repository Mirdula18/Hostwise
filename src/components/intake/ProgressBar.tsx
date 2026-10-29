type Props = { current: number; max: number };

export function ProgressBar({ current, max }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted" id="intake-progress-label">
        Question {current} of up to {max}
      </p>
      <progress
        aria-labelledby="intake-progress-label"
        value={current}
        max={max}
        className="h-2 w-full overflow-hidden rounded-full accent-brand"
      />
    </div>
  );
}
