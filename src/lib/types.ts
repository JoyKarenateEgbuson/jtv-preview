export type Role = "admin" | "client" | "guest";

/** A client (e.g. Tosin) or a one-time guest. Guests always get watermark on + downloads off. */
export type Person = {
  id: string;
  name: string;
  kind: "client" | "guest";
  /** Secret that forms the person's private page URL: /c/<token> */
  token: string;
  createdAt: number;
};

/** A folder of videos. Folders can contain other folders (parentId), and can be shared with clients. */
export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  /** People this folder (and everything inside it) is shared with. */
  personIds: string[];
  createdAt: number;
};

export type Video = {
  id: string;
  title: string;
  /** Which folder it sits in; empty/absent means the top level. */
  folderId?: string | null;
  /** All versions of the same piece share a stackId. */
  stackId: string;
  version: number;
  storage: "drive" | "local";
  /** Drive file id, or local file name. */
  fileRef: string;
  mimeType: string;
  size: number;
  fps: number;
  watermark: boolean;
  allowDownload: boolean;
  /** People this version is shared with. */
  personIds: string[];
  createdAt: number;
};

export type ShareLink = {
  id: string;
  token: string;
  /** The single video this link opens (empty for folder links). */
  videoId: string;
  /** Set for a folder link: opens that folder, its subfolders and every video inside. */
  folderId?: string | null;
  label: string;
  /** If set, this name goes on the watermark and comments. Otherwise the viewer is asked. */
  viewerName: string;
  /** Unix seconds, or 0 for never. */
  expiresAt: number;
  createdAt: number;
};

export type Comment = {
  id: string;
  videoId: string;
  author: string;
  role: Role;
  /** Seconds (frame-snapped). */
  time: number;
  /** Optional end of a range comment. */
  timeEnd: number | null;
  text: string;
  /** Visible to the admin/team only. */
  internal: boolean;
  resolved: boolean;
  parentId: string | null;
  createdAt: number;
  /** Set when the author edits the text. */
  editedAt?: number | null;
};
