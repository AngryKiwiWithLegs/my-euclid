import { contextBridge, ipcRenderer } from "electron";
import type { ArchiveHealth, ImportJobSummary, ImportKind, ImportResult } from "./types.js";

const validKind = (kind: ImportKind) => kind === "source_document" || kind === "paper_response";

contextBridge.exposeInMainWorld("myEuclid", {
  archive: {
    getHealth: (): Promise<ArchiveHealth> => ipcRenderer.invoke("archive:get-health"),
    listImportJobs: (): Promise<ImportJobSummary[]> => ipcRenderer.invoke("archive:list-import-jobs"),
    selectAndImport: (kind: ImportKind): Promise<ImportResult> => {
      if (!validKind(kind)) return Promise.reject(new Error("不支持的导入类型。"));
      return ipcRenderer.invoke("archive:select-and-import", kind);
    },
  },
  app: { openExternal: (url: string): Promise<void> => ipcRenderer.invoke("app:open-external", url) },
});
