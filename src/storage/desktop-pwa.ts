// Desktop assets ship in the installer; no browser service worker is needed.
export const registerSW =
  (_options: unknown) => async (_reload?: boolean) => {};
