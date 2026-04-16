import type { Group } from '../../hooks/useSidebarGroups';
import type { WPComSite } from '../../api/types';
import ContextMenu, {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  type ContextAnchor,
} from './ContextMenu';
import { FAVORITES_GROUP_ID } from '../../hooks/useSidebarGroups';

type Props = {
  anchor: ContextAnchor;
  site: WPComSite | null;
  currentGroupId: string;
  groups: Group[];
  unseen: number;
  onClose: () => void;
  onToggleFavorite: () => void;
  onMoveTo: (groupId: string) => void;
  onNewGroupAndMove: () => void;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
};

export default function SiteContextMenu({
  anchor,
  site,
  currentGroupId,
  groups,
  unseen,
  onClose,
  onToggleFavorite,
  onMoveTo,
  onNewGroupAndMove,
  onOpenSite,
  onMarkAllRead,
}: Props) {
  if (!site) return null;
  const isFavorited = currentGroupId === FAVORITES_GROUP_ID;

  return (
    <ContextMenu anchor={anchor} onClose={onClose} title={`${site.name} site menu`}>
      <ContextMenuItem
        onSelect={() => {
          onToggleFavorite();
          onClose();
        }}
      >
        {isFavorited ? 'Unfavorite' : 'Favorite'}
      </ContextMenuItem>

      <ContextMenuSubmenu label="Move to">
        {groups.map((g) => (
          <ContextMenuItem
            key={g.id}
            disabled={g.id === currentGroupId}
            onSelect={() => {
              onMoveTo(g.id);
              onClose();
            }}
          >
            {g.id === currentGroupId ? '✓ ' : ''}
            {g.name}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            onNewGroupAndMove();
            onClose();
          }}
        >
          New group…
        </ContextMenuItem>
      </ContextMenuSubmenu>

      <ContextMenuSeparator />

      <ContextMenuItem
        onSelect={() => {
          onOpenSite();
          onClose();
        }}
      >
        Open site
      </ContextMenuItem>

      {unseen > 0 && (
        <ContextMenuItem
          onSelect={() => {
            onMarkAllRead();
            onClose();
          }}
        >
          Mark all as read
        </ContextMenuItem>
      )}
    </ContextMenu>
  );
}
