import os from "node:os";

function isRfc1918(ip) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Pick the best non-loopback IPv4 on the current Wi‑Fi / LAN. */
export function detectLanIp() {
  const preferred = [];
  const fallback = [];

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      const family = iface.family;
      if (family !== "IPv4" && family !== 4) continue;
      if (iface.internal) continue;

      const ip = iface.address;
      if (ip.startsWith("169.254.")) continue;

      if (isRfc1918(ip)) preferred.push(ip);
      else fallback.push(ip);
    }
  }

  return preferred[0] ?? fallback[0] ?? "127.0.0.1";
}
