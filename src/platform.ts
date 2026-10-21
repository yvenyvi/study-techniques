// Runtime detection also works against a development server inside Tauri.
export const isDesktop =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function nativeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
