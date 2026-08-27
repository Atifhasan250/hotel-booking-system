export function isAllowedRequestOrigin(requestOrigin: string | null, applicationOrigin: string): boolean {
  if (!requestOrigin) return false;
  try {
    return new URL(requestOrigin).origin === new URL(applicationOrigin).origin;
  } catch {
    return false;
  }
}
