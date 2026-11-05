export function formatBytes(bytes: number): string {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0 || !Number.isFinite(bytesPerSecond)) return '0 KB/s';
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0 || !Number.isFinite(seconds)) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatEta(bytesRemaining: number, bytesPerSecond: number): string {
  if (bytesRemaining <= 0) return 'Complete';
  if (bytesPerSecond <= 0 || !Number.isFinite(bytesPerSecond)) return 'Estimating...';
  const seconds = bytesRemaining / bytesPerSecond;
  return formatDuration(seconds);
}

