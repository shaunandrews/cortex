import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { SyncStore } from '../sync/store';
import type { SavedItem, SavedGroup } from './types';

function makePostItem(siteId: number, postId: number, groupId: number | null = null): SavedItem {
  return {
    type: 'post',
    siteId,
    postId,
    commentId: null,
    groupId,
    savedAt: Date.now(),
    snapshot: {
      title: `Post ${postId}`,
      content: '<p>Content</p>',
      excerpt: 'Excerpt',
      authorName: 'Author',
      authorAvatar: '',
      siteName: `Site ${siteId}`,
      siteURL: `https://site${siteId}.test`,
      postURL: `https://site${siteId}.test/post-${postId}`,
      date: new Date().toISOString(),
    },
    tags: ['tag-a'],
  };
}

function makeCommentItem(
  siteId: number,
  postId: number,
  commentId: number,
  groupId: number | null = null,
): SavedItem {
  return {
    type: 'comment',
    siteId,
    postId,
    commentId,
    groupId,
    savedAt: Date.now(),
    snapshot: {
      content: '<p>Comment text</p>',
      authorName: 'Commenter',
      authorAvatar: '',
      postTitle: `Post ${postId}`,
      siteName: `Site ${siteId}`,
      siteURL: `https://site${siteId}.test`,
      postURL: `https://site${siteId}.test/post-${postId}`,
      date: new Date().toISOString(),
    },
    tags: ['tag-b'],
  };
}

function makeGroup(name: string, position: number): SavedGroup {
  return { name, createdAt: Date.now(), position };
}

describe('SyncStore — saved items', () => {
  let store: SyncStore;

  beforeEach(async () => {
    store = new SyncStore();
    await store.clearAll();
  });

  it('adds and retrieves saved items', async () => {
    const id = await store.addSavedItem(makePostItem(1, 100));
    expect(id).toBeGreaterThan(0);

    const items = await store.getSavedItems();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('post');
    expect(items[0].siteId).toBe(1);
    expect(items[0].postId).toBe(100);
  });

  it('finds saved items by uniqueness tuple', async () => {
    await store.addSavedItem(makePostItem(1, 100));
    await store.addSavedItem(makeCommentItem(1, 100, 50));

    const foundPost = await store.findSavedItem('post', 1, 100, null);
    expect(foundPost).toBeDefined();
    expect(foundPost!.type).toBe('post');

    const foundComment = await store.findSavedItem('comment', 1, 100, 50);
    expect(foundComment).toBeDefined();
    expect(foundComment!.commentId).toBe(50);

    const notFound = await store.findSavedItem('post', 1, 999, null);
    expect(notFound).toBeUndefined();
  });

  it('deletes a saved item', async () => {
    const id = await store.addSavedItem(makePostItem(1, 100));
    await store.deleteSavedItem(id);
    const items = await store.getSavedItems();
    expect(items).toHaveLength(0);
  });

  it('updates item group assignment', async () => {
    const itemId = await store.addSavedItem(makePostItem(1, 100));
    const groupId = await store.addSavedGroup(makeGroup('Research', 1));

    await store.updateSavedItemGroup(itemId, groupId);

    const items = await store.getSavedItems();
    expect(items[0].groupId).toBe(groupId);
  });

  it('filters items by group', async () => {
    const groupId = await store.addSavedGroup(makeGroup('Research', 1));
    await store.addSavedItem(makePostItem(1, 100, groupId));
    await store.addSavedItem(makePostItem(1, 200, null));

    const grouped = await store.getSavedItemsByGroup(groupId);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].postId).toBe(100);

    const ungrouped = await store.getSavedItemsByGroup(null);
    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0].postId).toBe(200);
  });

  it('moves items to ungrouped when group is deleted', async () => {
    const groupId = await store.addSavedGroup(makeGroup('Temp', 1));
    await store.addSavedItem(makePostItem(1, 100, groupId));
    await store.addSavedItem(makePostItem(1, 200, groupId));

    await store.deleteSavedGroup(groupId);

    const groups = await store.getSavedGroups();
    expect(groups).toHaveLength(0);

    const items = await store.getSavedItems();
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.groupId === null)).toBe(true);
  });
});

describe('SyncStore — saved groups', () => {
  let store: SyncStore;

  beforeEach(async () => {
    store = new SyncStore();
    await store.clearAll();
  });

  it('creates and retrieves groups', async () => {
    const id = await store.addSavedGroup(makeGroup('Research', 1));
    expect(id).toBeGreaterThan(0);

    const groups = await store.getSavedGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Research');
  });

  it('renames a group', async () => {
    const id = await store.addSavedGroup(makeGroup('Old Name', 1));
    const groups = await store.getSavedGroups();
    await store.updateSavedGroup({ ...groups[0], name: 'New Name' });

    const updated = await store.getSavedGroups();
    expect(updated[0].name).toBe('New Name');
    expect(updated[0].id).toBe(id);
  });
});
