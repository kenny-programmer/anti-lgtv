export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "closed";
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return "less than a minute left";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
