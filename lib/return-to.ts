// Where to send someone after they sign in. Only same-site paths are accepted, so the
// `returnTo` query of /sign-in can never be used as an open redirect.
export const safeReturnTo = (value: string | null | undefined): string | undefined => {
  if (!value || value.length > 512) return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value;
};

export const signInPath = (returnTo: string): string =>
  `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

export const pathAndSearch = (url: string): string => {
  const parsed = new URL(url);
  return parsed.pathname + parsed.search;
};
