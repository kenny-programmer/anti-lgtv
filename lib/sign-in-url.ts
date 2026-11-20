// WorkOS AuthKit's hosted sign-in page (an *.authkit.app address) lists whatever methods are
// enabled for the environment, and the visitor lands on a WorkOS-owned domain first. This app
// only offers "Sign in with Google", so the authorization URL is pointed straight at the
// Google provider instead: the visitor goes from our button to Google's account chooser.
// Everything else in the URL (client id, redirect URI, PKCE challenge, sealed state) is kept,
// except `screen_hint`: it only applies to the hosted AuthKit page, and WorkOS answers a Google
// request that carries it with its generic "Something went wrong" error page.
export const toGoogleSignInUrl = (authorizationUrl: string): string => {
  const url = new URL(authorizationUrl);
  url.searchParams.set("provider", "GoogleOAuth");
  url.searchParams.delete("screen_hint");
  return url.toString();
};
