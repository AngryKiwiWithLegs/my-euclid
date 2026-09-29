/**
 * 桥接层：唯一负责 window.myEuclid 的存在性判断与异步动作样板。
 * 组件一律通过 api() 访问本地 IPC，浏览器预览路径在此统一给出可读错误。
 */

type Bridge = NonNullable<Window["myEuclid"]>;

export const isDesktop =
  typeof window !== "undefined" && Boolean(window.myEuclid);

export function api(): Bridge {
  if (!window.myEuclid)
    throw new Error(
      "本地桌面接口不可用；请通过 `pnpm dev:desktop` 启动桌面版本。"
    );
  return window.myEuclid;
}

export function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

interface RunActionOptions {
  setBusy?: (busy: boolean) => void;
  notify?: (message: string, duration?: number) => void;
  fallbackError: string;
  work: () => Promise<void>;
}

/** 统一的 busy/notify/finally 异步动作样板，替代各组件复制的 try-catch 结构。 */
export async function runAction({
  setBusy,
  notify,
  fallbackError,
  work,
}: RunActionOptions): Promise<void> {
  try {
    setBusy?.(true);
    await work();
  } catch (error) {
    notify?.(toUserMessage(error, fallbackError));
  } finally {
    setBusy?.(false);
  }
}
