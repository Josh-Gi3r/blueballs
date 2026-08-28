export function canonicalRedirectUrl(
  input,
  requestHost = null,
  localDev = false,
) {
  const url = input instanceof URL ? new URL(input) : new URL(input);
  if (localDev) return null;
  const hostHeader = String(requestHost ?? "")
    .split(":")[0]
    .toLowerCase();
  if (
    hostHeader &&
    hostHeader !== "blueballs.tech" &&
    hostHeader !== "www.blueballs.tech"
  )
    return null;
  const isApex = url.hostname === "blueballs.tech";
  const isWww = url.hostname === "www.blueballs.tech";
  if (!isWww && !(isApex && url.protocol === "http:")) return null;
  url.hostname = "blueballs.tech";
  url.protocol = "https:";
  return url.toString();
}
