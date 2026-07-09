export type DbCareerEvent = {
  year: number;
  label: string;
  description?: string;
};

export type DbArtist = {
  id: string;
  name: string;
  name_en: string | null;
  spotify_id: string | null;
  origin: string;
  active_from: number;
  active_to: number | null;
  genres: string[];
  bio: string;
  career?: DbCareerEvent[];
  image_url: string | null;
};

export type DbAlbum = {
  id: string;
  title: string;
  artist_id: string;
  spotify_id: string | null;
  year: number;
  genre: string;
  release_type: "album" | "ep" | "compilation";
  cover_color: string;
  cover_url: string | null;
  tracks: unknown;
  avg_rating: number;
  rating_count: number;
};

export type DbReview = {
  id: string;
  album_id: string;
  album_title: string;
  artist_id: string;
  user_id: string | null;
  username: string;
  rating: number;
  rating_lyrics: number | null;
  rating_melody: number | null;
  rating_performance: number | null;
  rating_atmosphere: number | null;
  rating_completion: number | null;
  body: string;
  created_at: string;
  updated_at?: string | null;
  session_opt_out?: boolean;
};

export type DbTrackRating = {
  id: string;
  user_id: string;
  album_id: string;
  spotify_track_id: string;
  track_number: number;
  track_name: string;
  rating: number;
  created_at: string;
  updated_at: string;
};

export type DbProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
};

export type DbDiscussionCategory = {
  id: string;
  slug: string;
  name: string;
  position: number;
  created_at: string;
};

export type DbDiscussionThread = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  status: "draft" | "published";
  view_count: number;
  review_id: string | null;
  album_id: string | null;
  category_id: string | null;
  featured_rank: number | null;
  featured_note: string | null;
  featured_at: string | null;
  /** 凍結日時。null なら非凍結（監査 D-3）。 */
  locked_at: string | null;
  /** 凍結を行った管理者の uuid。既存行や解除後は null。 */
  locked_by: string | null;
  /** 凍結理由（任意）。 */
  lock_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type DbDiscussionPost = {
  id: string;
  thread_id: string;
  anonymous_name: string;
  body: string;
  parent_post_id: string | null;
  /** ログイン投稿者のID（匿名表示でも内部保存）。既存レス・匿名未ログインは null。 */
  author_id: string | null;
  /** 匿名表示で投稿されたか。公開履歴は false のみに限定する。 */
  is_anonymous: boolean;
  /** 5ch 式スレ内ID（日付JSTで変わる短いハッシュ）。既存レスは null。 */
  thread_local_id: string | null;
  created_at: string;
};

export type DbDiscussionPollOption = {
  id: string;
  thread_id: string;
  label: string;
  position: number;
  option_type: "text" | "album" | "artist";
  album_id: string | null;
  artist_id: string | null;
  exclude_from_tally: boolean;
  created_at: string;
};

export type DbDiscussionPollVote = {
  id: string;
  thread_id: string;
  option_id: string;
  voter_key: string;
  created_at: string;
};

export type DbReviewComment = {
  id: string;
  review_id: string;
  author_id: string | null;
  anonymous_name: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
};

export type DbReviewReaction = {
  id: string;
  review_id: string;
  user_id: string | null;
  voter_key: string | null;
  reaction: "good" | "bad";
  created_at: string;
};

export type DbDiscussionPostReaction = {
  id: string;
  post_id: string;
  user_id: string | null;
  voter_key: string | null;
  reaction: "good" | "bad";
  created_at: string;
};

export type DbContentReport = {
  id: string;
  target_type: "discussion_post" | "review" | "review_comment";
  target_id: string;
  reporter_user_id: string | null;
  reporter_voter_key: string | null;
  reason: "spam" | "harassment" | "inappropriate" | "other";
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolution: "deleted" | "dismissed" | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type DbUserList = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type DbUserListItem = {
  id: string;
  list_id: string;
  album_id: string;
  position: number;
  note: string | null;
};

export type DbContributionKind = "add_artist" | "add_album" | "fix_data";

export type DbContributionStatus = "pending" | "approved" | "rejected";

export type DbContributionRequest = {
  id: string;
  requester_id: string;
  kind: DbContributionKind;
  target_artist_id: string | null;
  target_album_id: string | null;
  payload: Record<string, unknown>;
  status: DbContributionStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type DbNotificationType =
  | "thread_reply"
  | "post_reply"
  | "review_comment"
  | "comment_reply"
  | "reaction"
  | "follow"
  | "contribution";

export type DbNotification = {
  id: string;
  user_id: string;
  type: DbNotificationType;
  actor_name: string;
  actor_id: string | null;
  thread_id: string | null;
  review_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
};
