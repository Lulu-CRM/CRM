/** A channel value as a link that opens in a new tab, or as text when it is not a usable link. */
export function channel(value: string | null, toUrl: (value: string) => string | null, label: string): React.ReactNode {
  if (!value) return "–";
  const url = toUrl(value);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" title={label} className="text-primary underline-offset-2 hover:underline">
      {value} ↗
    </a>
  ) : (
    value
  );
}
