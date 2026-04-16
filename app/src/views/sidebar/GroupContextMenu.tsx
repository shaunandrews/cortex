import type { Group, SortMode } from '../../hooks/useSidebarGroups';
import ContextMenu, {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
  type ContextAnchor,
} from './ContextMenu';

type Props = {
  anchor: ContextAnchor;
  group: Group | null;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleCollapse: () => void;
  onToggleShowUnread: () => void;
  onSetSort: (mode: SortMode) => void;
  onNewGroup: () => void;
};

export default function GroupContextMenu({
  anchor,
  group,
  onClose,
  onRename,
  onDelete,
  onToggleCollapse,
  onToggleShowUnread,
  onSetSort,
  onNewGroup,
}: Props) {
  if (!group) return null;
  const isDefault = group.kind !== 'custom';

  return (
    <ContextMenu anchor={anchor} onClose={onClose} title={`${group.name} group menu`}>
      <ContextMenuItem
        disabled={isDefault}
        onSelect={() => {
          onRename();
          onClose();
        }}
      >
        Rename…
      </ContextMenuItem>

      <ContextMenuSubmenu label="Sort by">
        <ContextMenuItem
          onSelect={() => {
            onSetSort('alpha');
            onClose();
          }}
        >
          {group.sortMode === 'alpha' ? '✓ ' : ''}Alphabetical
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onSetSort('recent');
            onClose();
          }}
        >
          {group.sortMode === 'recent' ? '✓ ' : ''}Recent activity
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onSetSort('unread');
            onClose();
          }}
        >
          {group.sortMode === 'unread' ? '✓ ' : ''}Unread first
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            onSetSort('custom');
            onClose();
          }}
        >
          {group.sortMode === 'custom' ? '✓ ' : ''}Custom
        </ContextMenuItem>
      </ContextMenuSubmenu>

      <ContextMenuItem
        onSelect={() => {
          onToggleCollapse();
          onClose();
        }}
      >
        {group.collapsed ? 'Expand' : 'Collapse'}
      </ContextMenuItem>

      <ContextMenuItem
        onSelect={() => {
          onToggleShowUnread();
          onClose();
        }}
      >
        {group.showUnread ? '✓ ' : ''}Show unread counts
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        onSelect={() => {
          onNewGroup();
          onClose();
        }}
      >
        New group…
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        destructive
        disabled={isDefault}
        onSelect={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </ContextMenuItem>
    </ContextMenu>
  );
}
