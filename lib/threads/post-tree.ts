import type { DiscussionPost } from "@/lib/types";

export type DiscussionPostNode = DiscussionPost & {
  children: DiscussionPostNode[];
};

function sortNodesByCreatedAt(nodes: DiscussionPostNode[]): void {
  nodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const node of nodes) {
    sortNodesByCreatedAt(node.children);
  }
}

export function buildDiscussionPostTree(
  posts: DiscussionPost[],
): DiscussionPostNode[] {
  const nodeById = new Map<string, DiscussionPostNode>();

  for (const post of posts) {
    nodeById.set(post.id, { ...post, children: [] });
  }

  const roots: DiscussionPostNode[] = [];

  for (const post of posts) {
    const node = nodeById.get(post.id);
    if (!node) continue;

    if (post.parentPostId && nodeById.has(post.parentPostId)) {
      nodeById.get(post.parentPostId)!.children.push(node);
      continue;
    }

    roots.push(node);
  }

  sortNodesByCreatedAt(roots);
  return roots;
}

export function countDiscussionPostDescendants(
  node: DiscussionPostNode,
): number {
  return node.children.reduce(
    (sum, child) => sum + 1 + countDiscussionPostDescendants(child),
    0,
  );
}

/** 返信スレッドをまとめて開閉するときの対象 ID（自身＋返信を持つ子孫） */
export function collectSubtreeCollapsibleIds(
  node: DiscussionPostNode,
): string[] {
  if (node.children.length === 0) return [];

  const ids = [node.id];
  for (const child of node.children) {
    ids.push(...collectSubtreeCollapsibleIds(child));
  }
  return ids;
}

export function findDiscussionPostNode(
  nodes: DiscussionPostNode[],
  id: string,
): DiscussionPostNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findDiscussionPostNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function collectSubtreeCollapsibleIdsForPost(
  posts: DiscussionPost[],
  rootId: string,
): string[] {
  const node = findDiscussionPostNode(buildDiscussionPostTree(posts), rootId);
  return node ? collectSubtreeCollapsibleIds(node) : [];
}

/** 返信を持つコメント ID（初期表示で畳む対象） */
export function collectCollapsiblePostIds(posts: DiscussionPost[]): string[] {
  const childCount = new Map<string, number>();

  for (const post of posts) {
    if (!post.parentPostId) continue;
    childCount.set(
      post.parentPostId,
      (childCount.get(post.parentPostId) ?? 0) + 1,
    );
  }

  return posts
    .filter((post) => (childCount.get(post.id) ?? 0) > 0)
    .map((post) => post.id);
}

/** Reddit は深いネストでも横インデントの上限がある */
export const REDDIT_MAX_INDENT_DEPTH = 8;

/** 返信スレッドを初期非表示にするコメント ID */
export function buildInitialCollapsedIds(
  posts: DiscussionPost[],
): Set<string> {
  return new Set(collectCollapsiblePostIds(posts));
}
