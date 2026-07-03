import { describe, it, expect } from "vitest";
import {
  buildDiscussionPostTree,
  countDiscussionPostDescendants,
  collectSubtreeCollapsibleIds,
  findDiscussionPostNode,
  collectSubtreeCollapsibleIdsForPost,
  collectCollapsiblePostIds,
  buildInitialCollapsedIds,
} from "@/lib/threads/post-tree";
import type { DiscussionPost } from "@/lib/types";

function post(
  id: string,
  parentPostId: string | null,
  createdAt: string,
): DiscussionPost {
  return {
    id,
    threadId: "t1",
    anonymousName: "名無し",
    body: `body-${id}`,
    parentPostId,
    replyPostIds: [],
    createdAt,
  };
}

describe("buildDiscussionPostTree", () => {
  it("空配列は空配列", () => {
    expect(buildDiscussionPostTree([])).toEqual([]);
  });

  it("親子関係でネストする", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("b");
  });

  it("親が存在しない場合はルート扱いになる", () => {
    const posts = [post("orphan", "missing-parent", "2026-01-01T00:00:00Z")];
    const tree = buildDiscussionPostTree(posts);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("orphan");
  });

  it("同階層はcreatedAt昇順にソートされる", () => {
    const posts = [
      post("late", null, "2026-01-02T00:00:00Z"),
      post("early", null, "2026-01-01T00:00:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    expect(tree.map((n) => n.id)).toEqual(["early", "late"]);
  });

  it("子もcreatedAt昇順にソートされる", () => {
    const posts = [
      post("root", null, "2026-01-01T00:00:00Z"),
      post("c2", "root", "2026-01-01T00:02:00Z"),
      post("c1", "root", "2026-01-01T00:01:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    expect(tree[0].children.map((n) => n.id)).toEqual(["c1", "c2"]);
  });
});

describe("countDiscussionPostDescendants", () => {
  it("子孫を再帰的に数える", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
      post("c", "b", "2026-01-01T00:02:00Z"),
      post("d", "a", "2026-01-01T00:03:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    // a の子孫: b, c, d = 3
    expect(countDiscussionPostDescendants(tree[0])).toBe(3);
  });

  it("葉ノードは0", () => {
    const tree = buildDiscussionPostTree([post("a", null, "2026-01-01T00:00:00Z")]);
    expect(countDiscussionPostDescendants(tree[0])).toBe(0);
  });
});

describe("collectSubtreeCollapsibleIds", () => {
  it("子が無ければ空配列（自身も含めない）", () => {
    const tree = buildDiscussionPostTree([post("a", null, "2026-01-01T00:00:00Z")]);
    expect(collectSubtreeCollapsibleIds(tree[0])).toEqual([]);
  });

  it("子を持つノードは自身＋子孫の折り畳み対象を返す", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
      post("c", "b", "2026-01-01T00:02:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    // a(子あり) と b(子あり) は含む、c(葉) は含まない
    expect(collectSubtreeCollapsibleIds(tree[0])).toEqual(["a", "b"]);
  });
});

describe("findDiscussionPostNode", () => {
  it("深い階層のノードを見つける", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
      post("c", "b", "2026-01-01T00:02:00Z"),
    ];
    const tree = buildDiscussionPostTree(posts);
    expect(findDiscussionPostNode(tree, "c")?.id).toBe("c");
  });

  it("存在しないIDはnull", () => {
    const tree = buildDiscussionPostTree([post("a", null, "2026-01-01T00:00:00Z")]);
    expect(findDiscussionPostNode(tree, "zzz")).toBeNull();
  });
});

describe("collectSubtreeCollapsibleIdsForPost", () => {
  it("指定ルート配下の折り畳み対象を返す", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
      post("c", "b", "2026-01-01T00:02:00Z"),
    ];
    expect(collectSubtreeCollapsibleIdsForPost(posts, "a")).toEqual(["a", "b"]);
  });

  it("存在しないルートは空配列", () => {
    const posts = [post("a", null, "2026-01-01T00:00:00Z")];
    expect(collectSubtreeCollapsibleIdsForPost(posts, "missing")).toEqual([]);
  });
});

describe("collectCollapsiblePostIds", () => {
  it("返信を持つ投稿IDのみ返す", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
      post("c", null, "2026-01-01T00:02:00Z"),
    ];
    // a は子を持つ、b と c は持たない
    expect(collectCollapsiblePostIds(posts)).toEqual(["a"]);
  });

  it("返信が無ければ空配列", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", null, "2026-01-01T00:01:00Z"),
    ];
    expect(collectCollapsiblePostIds(posts)).toEqual([]);
  });
});

describe("buildInitialCollapsedIds", () => {
  it("返信を持つIDのSetを返す", () => {
    const posts = [
      post("a", null, "2026-01-01T00:00:00Z"),
      post("b", "a", "2026-01-01T00:01:00Z"),
    ];
    const result = buildInitialCollapsedIds(posts);
    expect(result).toBeInstanceOf(Set);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(false);
  });
});
