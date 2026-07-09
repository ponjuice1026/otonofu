export type CareerEvent = {
  year: number;
  label: string;
  description?: string;
};

export type Artist = {
  id: string;
  name: string;
  nameEn?: string;
  spotifyId?: string;
  origin: string;
  activeFrom: number;
  activeTo?: number;
  genres: string[];
  bio: string;
  career: CareerEvent[];
  imageUrl?: string;
};

export type AlbumTrack = {
  id: string;
  number: number;
  name: string;
  duration: string;
};

export type Album = {
  id: string;
  title: string;
  artistId: string;
  spotifyId?: string;
  year: number;
  genre: string;
  type: "album" | "ep" | "compilation";
  coverColor: string;
  coverUrl?: string;
  tracks?: AlbumTrack[];
  avgRating: number;
  ratingCount: number;
};

export type AlbumCriteriaRatings = {
  lyrics: number;
  melody: number;
  performance: number;
  atmosphere: number;
  completion: number;
};

export type Review = {
  id: string;
  albumId: string;
  albumTitle: string;
  artistId: string;
  userId?: string;
  username: string;
  rating: number;
  criteriaRatings?: AlbumCriteriaRatings;
  body: string;
  createdAt: string;
  sessionOptOut?: boolean;
  threadId?: string;
};

export type TrackRating = {
  id: string;
  albumId: string;
  spotifyTrackId: string;
  trackNumber: number;
  trackName: string;
  rating: number;
  userId: string;
};

export type ThreadCategory = {
  id: string;
  slug: string;
  name: string;
  position: number;
};

export type DiscussionThread = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  status: "draft" | "published";
  postCount: number;
  viewCount: number;
  hasPoll: boolean;
  reviewId?: string;
  albumId?: string;
  /** 紐付くカテゴリ（板）のID。未分類は null。 */
  categoryId: string | null;
  /** カテゴリ名（データ層で解決）。未分類は null。 */
  categoryName: string | null;
  kind: "album" | "topic";
  featuredRank: number | null;
  featuredNote: string | null;
  /** 凍結日時（ISO文字列）。null なら非凍結（監査 D-3）。 */
  lockedAt: string | null;
  /** 凍結理由（任意）。 */
  lockReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PollOptionAlbumRef = {
  id: string;
  title: string;
  artistName: string;
  year: number | null;
  coverUrl?: string;
  spotifyId?: string;
};

export type PollOptionArtistRef = {
  id: string;
  name: string;
  imageUrl?: string;
  spotifyId?: string;
};

export type DiscussionPollOption = {
  id: string;
  label: string;
  position: number;
  voteCount: number;
  type: "text" | "album" | "artist";
  excludeFromTally: boolean;
  album?: PollOptionAlbumRef;
  artist?: PollOptionArtistRef;
};

export type DiscussionPoll = {
  threadId: string;
  options: DiscussionPollOption[];
  totalVotes: number;
  userVotedOptionId: string | null;
};

export type DiscussionPost = {
  id: string;
  threadId: string;
  anonymousName: string;
  body: string;
  parentPostId: string | null;
  replyPostIds: string[];
  /**
   * ログイン投稿者のID。匿名表示レスでも内部保存されている。
   * UI では「自分のレスか」の判定にのみ使い、実名表示には使わない。
   * 既存レス・匿名未ログイン投稿は null。
   */
  authorId: string | null;
  /** 匿名表示で投稿されたか。公開履歴の絞り込みに使う。 */
  isAnonymous: boolean;
  /** 5ch 式スレ内ID（薄色で表示）。既存レスは null。 */
  threadLocalId: string | null;
  createdAt: string;
};

export type ReactionKind = "good" | "bad";

export type ReactionState = {
  good: number;
  bad: number;
  userReaction: ReactionKind | null;
};

export type ReviewComment = {
  id: string;
  reviewId: string;
  authorId: string | null;
  anonymousName: string;
  body: string;
  parentCommentId: string | null;
  index: number;
  parentIndex: number | null;
  replyIndices: number[];
  createdAt: string;
};

export type UserListItem = {
  id: string;
  listId: string;
  albumId: string;
  position: number;
  note?: string;
  /** アルバム情報（データ層で解決） */
  albumTitle: string;
  artistId: string;
  artistName: string;
  year: number;
  coverUrl?: string;
  coverColor: string;
  spotifyId?: string;
};

export type UserList = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  description?: string;
  isPublic: boolean;
  itemCount: number;
  /** カバーコラージュ用の先頭数件（一覧カード表示用） */
  coverItems: {
    albumId: string;
    coverUrl?: string;
    coverColor: string;
    spotifyId?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  /** 詳細取得時のみ埋まる。一覧では空配列 */
  items: UserListItem[];
};

export type ContributionKind = "add_artist" | "add_album" | "fix_data";

export type ContributionStatus = "pending" | "approved" | "rejected";

export type ContributionRequest = {
  id: string;
  requesterId: string;
  kind: ContributionKind;
  targetArtistId: string | null;
  targetAlbumId: string | null;
  payload: Record<string, unknown>;
  status: ContributionStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export type NotificationType =
  | "thread_reply"
  | "post_reply"
  | "review_comment"
  | "comment_reply"
  | "reaction"
  | "follow"
  | "contribution";

export type Notification = {
  id: string;
  type: NotificationType;
  actorName: string;
  /** 通知の発生源ユーザーID。フォロー通知の遷移先解決に使う（無ければ null） */
  actorId: string | null;
  threadId: string | null;
  reviewId: string | null;
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
  /** 遷移先URL（データ層で解決） */
  href: string;
};
