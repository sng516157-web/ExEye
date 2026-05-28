/** True when running inside the Even App WebView or EvenHub simulator (not a plain browser tab). */
export function isEvenHubHostAvailable(): boolean {
  const w = window as typeof window & {
    flutter_inappwebview?: { callHandler?: (...args: unknown[]) => unknown };
  };

  return typeof w.flutter_inappwebview?.callHandler === "function";
}
