// WorkOS AuthKit's hosted sign-in page (an *.authkit.app address) lists whatever methods are
// enabled for the environment, and the visitor lands on a WorkOS-owned domain first. This app
// only offers "Sign in with Google", so the authorization URL is pointed straight at the
// Google provider instead: the visitor goes from our button to Google's account chooser.
// Everything else in the URL (client id, redirect URI, PKCE challenge, sealed state) is kept.
export const toGoogleSignInUrl = (authorizationUrl: string): string => {
  const url = new URL(authorizationUrl);
  url.searchParams.set("provider", "GoogleOAuth");
  return url.toString();
};
