/**
 * Sanitizes an incoming file name to prevent directory traversal or filesystem exploitation.
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') return 'unnamed_file';
  // Strip paths (e.g., ../ or C:\)
  const baseName = name.replace(/^.*[\\/]/, '');
  // Remove non-printable or dangerous control characters
  const cleaned = baseName.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '_').trim();
  // Truncate to maximum 120 characters while preserving extension
  if (cleaned.length > 120) {
    const extIndex = cleaned.lastIndexOf('.');
    if (extIndex > 0 && extIndex > cleaned.length - 15) {
      const ext = cleaned.substring(extIndex);
      return cleaned.substring(0, 120 - ext.length) + ext;
    }
    return cleaned.substring(0, 120);
  }
  return cleaned || 'unnamed_file';
}

/**
 * Infers an appropriate MIME type when Android Chrome or mobile pickers return empty strings.
 */
export function inferMimeType(fileName: string, reportedType?: string): string {
  if (reportedType && reportedType !== 'application/octet-stream' && reportedType.trim() !== '') {
    return reportedType;
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    // Images
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';

    // Video
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    case 'mkv':
      return 'video/x-matroska';

    // Audio
    case 'mp3':
      return 'audio/mpeg';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
    case 'oga':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';

    // Documents & Archives
    case 'pdf':
      return 'application/pdf';
    case 'zip':
      return 'application/zip';
    case 'tar':
      return 'application/x-tar';
    case 'gz':
      return 'application/gzip';
    case 'apk':
      return 'application/vnd.android.package-archive';
    case 'txt':
      return 'text/plain';
    case 'json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Safe maximum file size check (1 GB maximum recommended for in-browser mobile WebRTC).
 */
export const MAX_SAFE_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB
export const MOBILE_FILE_WARNING_THRESHOLD = 250 * 1024 * 1024; // 250 MB

