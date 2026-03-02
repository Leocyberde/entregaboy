export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://auth.replit.com";
  const appId = import.meta.env.VITE_APP_ID || "default-app-id";

  // Validate that required environment variables are set
  if (!oauthPortalUrl || !appId) {
    console.error(
      "Missing required environment variables: VITE_OAUTH_PORTAL_URL or VITE_APP_ID"
    );
    // Return a safe fallback URL or throw an error
    return "/";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error("Failed to construct login URL:", error);
    return "/";
  }
};
