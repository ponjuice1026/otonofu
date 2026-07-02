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
