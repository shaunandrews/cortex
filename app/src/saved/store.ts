import { getSharedStore } from '../sync/store';
import type { SavedItem, SavedGroup } from './types';

export async function getAllSavedItems(): Promise<SavedItem[]> {
  return getSharedStore().getSavedItems();
}

export async function getSavedItemsByGroup(groupId: number | null): Promise<SavedItem[]> {
  return getSharedStore().getSavedItemsByGroup(groupId);
}

export async function findSavedItem(
  type: 'post' | 'comment',
  siteId: number,
  postId: number,
  commentId: number | null,
): Promise<SavedItem | undefined> {
  return getSharedStore().findSavedItem(type, siteId, postId, commentId);
}

export async function addSavedItem(item: SavedItem): Promise<number> {
  return getSharedStore().addSavedItem(item);
}

export async function deleteSavedItem(id: number): Promise<void> {
  return getSharedStore().deleteSavedItem(id);
}

export async function updateSavedItemGroup(id: number, groupId: number | null): Promise<void> {
  return getSharedStore().updateSavedItemGroup(id, groupId);
}

export async function updateSavedItemPosition(id: number, x: number, y: number): Promise<void> {
  return getSharedStore().updateSavedItemPosition(id, x, y);
}

export async function getAllSavedGroups(): Promise<SavedGroup[]> {
  return getSharedStore().getSavedGroups();
}

export async function addSavedGroup(group: SavedGroup): Promise<number> {
  return getSharedStore().addSavedGroup(group);
}

export async function updateSavedGroup(group: SavedGroup): Promise<void> {
  return getSharedStore().updateSavedGroup(group);
}

export async function deleteSavedGroup(id: number): Promise<void> {
  return getSharedStore().deleteSavedGroup(id);
}
