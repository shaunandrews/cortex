import { Icon, IconButton, Text } from '@wordpress/ui';
import {
  home,
  archive,
  starFilled,
  starEmpty,
  comment as commentIcon,
  closeSmall,
  rotateRight,
  search,
} from '@wordpress/icons';
import AppHeader from './AppHeader';
import {
  ActionButton,
  AvatarButton,
  EmptyState,
  GroupHeader,
  MenuItem,
  PanelHeader,
  PostRowCard,
  SiteIcon,
  SyncStatusBar,
  TabNav,
} from '../components';

// Tiny inline SVG data-URIs so image specimens don't hit the network.
const demoImageA =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23b2a1ff"/><text x="12" y="16" font-family="sans-serif" font-size="13" font-weight="600" fill="white" text-anchor="middle">A</text></svg>';
const demoImageB =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23ff9f5c"/><text x="12" y="16" font-family="sans-serif" font-size="13" font-weight="600" fill="white" text-anchor="middle">W</text></svg>';
const demoAvatarA =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%23ffb5a7"/><text x="20" y="26" font-family="sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">S</text></svg>';
const demoAvatarB =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%2397d0ad"/><text x="20" y="26" font-family="sans-serif" font-size="18" font-weight="600" fill="white" text-anchor="middle">M</text></svg>';

export default function ComponentsCatalog() {
  return (
    <div className="authed-layout">
      <AppHeader />
      <main className="catalog">
        <div className="catalog-content">
          <header className="catalog-header">
            <Text variant="heading-xl">Components</Text>
            <Text variant="body-md" className="catalog-subtitle">
              Cortex&rsquo;s own component system. One entry per component, with every state and
              slot combination rendered inline so we can see what we&rsquo;re working with.
            </Text>
          </header>

          {/* ───────────────────────── MenuItem ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">MenuItem</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                A single row for menus and navigation. Supports icon and count slots, plus resting,
                hover, focus, active, and selected states. Used in the sidebar for Home, Saved, and
                site entries.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Nav icon · resting">
                <MenuItem icon={<Icon icon={home} size={20} />} label="Home" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Nav icon · selected">
                <MenuItem icon={<Icon icon={home} size={20} />} label="Home" isSelected />
              </CatalogSpecimen>
              <CatalogSpecimen label="Nav icon · focused (keyboard)">
                <MenuItem icon={<Icon icon={archive} size={20} />} label="Saved" isFocused />
              </CatalogSpecimen>
              <CatalogSpecimen label="Site icon · letter">
                <MenuItem icon={<SiteIcon name="Design" />} label="Design" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Site icon · image">
                <MenuItem
                  icon={<SiteIcon name="Automattic" src={demoImageA} />}
                  label="Automattic"
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Site icon · with count">
                <MenuItem icon={<SiteIcon name="Engineering" />} label="Engineering" count={12} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Site icon · selected + count">
                <MenuItem
                  icon={<SiteIcon name="Product" src={demoImageB} />}
                  label="Product"
                  count={3}
                  isSelected
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Long label truncates">
                <MenuItem
                  icon={<SiteIcon name="Special Projects" />}
                  label="A very long site name that should truncate with an ellipsis"
                  count={99}
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Hover / focus / active">
                <MenuItem icon={<SiteIcon name="Try Me" />} label="Hover, tab, or click" />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── GroupHeader ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">GroupHeader</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Accordion-style section header with a trailing caret that rotates on{' '}
                <code>isOpen</code>. Used in the sidebar for group headings (Favorites, Sites,
                custom groups). Sticky by default so it pins as you scroll. Spreads props for
                dnd-kit sortable attachment.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Open">
                <GroupHeader label="Favorites" isOpen />
              </CatalogSpecimen>
              <CatalogSpecimen label="Closed">
                <GroupHeader label="Favorites" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Long label truncates">
                <GroupHeader
                  label="A very long group name that should truncate with an ellipsis"
                  isOpen
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Dragging">
                <GroupHeader label="Design" isOpen isDragging />
              </CatalogSpecimen>
              <CatalogSpecimen label="Drag overlay">
                <GroupHeader className="is-dragging-overlay" label="Engineering" isOpen />
              </CatalogSpecimen>
              <CatalogSpecimen label="Hover / focus / click">
                <GroupHeader label="Try me" />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── SiteIcon ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">SiteIcon</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                A 24×24 avatar for sites. Renders an image when provided, otherwise the first letter
                of the site name on a subtle grey tile. Domain-agnostic — composes into MenuItem,
                PostRowCard, panels, etc.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Letter · short name">
                <SiteIcon name="Design" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Letter · lowercase input">
                <SiteIcon name="engineering" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Image · purple">
                <SiteIcon name="Automattic" src={demoImageA} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Image · orange">
                <SiteIcon name="WooCommerce" src={demoImageB} />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── PanelHeader ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">PanelHeader</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Standardized top bar for panels — feed, detail, workspace regions. Two slots:
                <code> start</code> (typically icon + title) and <code>end</code> (action buttons).
                A bottom border separates it from the panel body.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Title only">
                <PanelHeader
                  start={
                    <Text variant="heading-sm" className="page-title">
                      Feed
                    </Text>
                  }
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Start + end">
                <PanelHeader
                  start={
                    <Text variant="heading-sm" className="page-title">
                      Feed
                    </Text>
                  }
                  end={<IconButton icon={rotateRight} label="Refresh" variant="minimal" />}
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Site icon + title + actions">
                <PanelHeader
                  start={
                    <>
                      <SiteIcon name="Automattic" src={demoImageA} />
                      <Text variant="heading-sm" className="page-title">
                        Automattic
                      </Text>
                    </>
                  }
                  end={
                    <>
                      <IconButton icon={rotateRight} label="Refresh" variant="minimal" />
                      <IconButton icon={closeSmall} label="Close" variant="minimal" />
                    </>
                  }
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Long title truncates">
                <PanelHeader
                  start={
                    <>
                      <SiteIcon name="Special Projects" />
                      <Text variant="heading-sm" className="page-title">
                        A very long panel title that should truncate with an ellipsis
                      </Text>
                    </>
                  }
                  end={<IconButton icon={closeSmall} label="Close" variant="minimal" />}
                />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── ActionButton ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">ActionButton</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Compact icon+label button for inline post actions — like, save, comment toggle.
                Supports <code>isActive</code> for persistent on/off, and a <code>danger</code>{' '}
                variant that turns red when active.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Neutral · resting">
                <ActionButton icon={<Icon icon={starEmpty} size={20} />}>Save</ActionButton>
              </CatalogSpecimen>
              <CatalogSpecimen label="Neutral · active">
                <ActionButton icon={<Icon icon={starFilled} size={20} />} isActive>
                  Saved
                </ActionButton>
              </CatalogSpecimen>
              <CatalogSpecimen label="Danger · resting">
                <ActionButton icon={<Icon icon={starEmpty} size={20} />} variant="danger">
                  12
                </ActionButton>
              </CatalogSpecimen>
              <CatalogSpecimen label="Danger · active (liked)">
                <ActionButton icon={<Icon icon={starFilled} size={20} />} variant="danger" isActive>
                  13
                </ActionButton>
              </CatalogSpecimen>
              <CatalogSpecimen label="With count">
                <ActionButton icon={<Icon icon={commentIcon} size={20} />}>8</ActionButton>
              </CatalogSpecimen>
              <CatalogSpecimen label="Icon only">
                <ActionButton icon={<Icon icon={commentIcon} size={20} />} aria-label="Comment" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Disabled">
                <ActionButton icon={<Icon icon={starEmpty} size={20} />} disabled>
                  Save
                </ActionButton>
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── AvatarButton ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">AvatarButton</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Circular user avatar that acts as a button. With <code>menu</code>, opens a Popover
                — used for the account menu in the header. Without, it&rsquo;s a plain clickable
                avatar for comments, likes, etc.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Plain · default size (28)">
                <AvatarButton src={demoAvatarA} alt="Shaun" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Plain · small (20)">
                <AvatarButton src={demoAvatarA} alt="Shaun" size={20} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Plain · large (40)">
                <AvatarButton src={demoAvatarB} alt="Mira" size={40} />
              </CatalogSpecimen>
              <CatalogSpecimen label="With popover menu">
                <AvatarButton
                  src={demoAvatarA}
                  alt="Shaun"
                  menuTitle="Account menu"
                  menu={
                    <>
                      <Text variant="body-sm" className="avatar-menu-name">
                        Shaun Andrews
                      </Text>
                      <MenuItem label="Sign out" />
                    </>
                  }
                />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── SyncStatusBar ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">SyncStatusBar</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Compact progress strip — lives at the bottom of the sidebar. Renders nothing when
                <code> phase === &apos;idle&apos;</code>. Takes props rather than calling the sync
                hook internally so it&rsquo;s testable and composable.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Bootstrapping">
                <SyncStatusBar phase="bootstrapping" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Prefetching · early">
                <SyncStatusBar phase="prefetching" progress={{ fetched: 3, total: 42 }} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Prefetching · mid">
                <SyncStatusBar phase="prefetching" progress={{ fetched: 23, total: 42 }} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Prefetching · nearly done">
                <SyncStatusBar phase="prefetching" progress={{ fetched: 40, total: 42 }} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Maintaining · live">
                <SyncStatusBar phase="maintaining" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Maintaining · with time">
                <SyncStatusBar phase="maintaining" lastUpdatedLabel="2 minutes ago" />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── PostRowCard ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">PostRowCard</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                A clickable row for a post: author avatar, title, author name, and a relative time
                string (pre-formatted by the caller). Used in home-page site sections and
                potentially in feed lists.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Resting">
                <PostRowCard
                  authorAvatar={demoAvatarA}
                  title="New docs for the onboarding flow"
                  author="Shaun Andrews"
                  date="2 hours ago"
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Selected">
                <PostRowCard
                  authorAvatar={demoAvatarB}
                  title="Kickoff notes — design systems week"
                  author="Mira Kim"
                  date="yesterday"
                  isSelected
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="No avatar">
                <PostRowCard
                  title="A quick shipping update"
                  author="Shaun Andrews"
                  date="5 min ago"
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Title only">
                <PostRowCard title="Idea: what if we…" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Long title truncates">
                <PostRowCard
                  authorAvatar={demoAvatarA}
                  title="A very long post title that absolutely will not fit on a single line in the sidebar or feed panel"
                  author="Shaun Andrews"
                  date="3 hours ago"
                />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── EmptyState ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">EmptyState</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                A consistent empty placeholder — for no-results lists, blank panels, the catalog
                stub itself. Optional icon, title, and action CTA. Keep copy honest about
                what&rsquo;s missing.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Message only">
                <EmptyState message="No matches" />
              </CatalogSpecimen>
              <CatalogSpecimen label="Icon + title + message">
                <EmptyState
                  icon={<Icon icon={search} size={32} />}
                  title="Nothing found"
                  message="Try a different search term or clear the filter."
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="With action">
                <EmptyState
                  icon={<Icon icon={starEmpty} size={32} />}
                  title="No favorites yet"
                  message="Star sites in the sidebar to see them here."
                  action={{ label: 'Browse sites', onClick: () => {} }}
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Compact (message only, no action)">
                <EmptyState
                  title="Nothing scheduled"
                  message="You&rsquo;re all caught up for today."
                />
              </CatalogSpecimen>
            </div>
          </section>

          {/* ───────────────────────── TabNav ───────────────────────── */}
          <section className="catalog-section">
            <header className="catalog-section-header">
              <Text variant="heading-lg">TabNav</Text>
              <Text variant="body-sm" className="catalog-section-desc">
                Horizontal tab bar backed by <code>NavLink</code> — the active state reflects the
                current route. Used in the app header. Accepts any array of{' '}
                <code>{`{ to, label }`}</code>.
              </Text>
            </header>
            <div className="catalog-specimens">
              <CatalogSpecimen label="Single tab">
                <TabNav tabs={[{ to: '/components', label: 'Components' }]} />
              </CatalogSpecimen>
              <CatalogSpecimen label="Multiple tabs">
                <TabNav
                  tabs={[
                    { to: '/components', label: 'Components' },
                    { to: '/tokens', label: 'Tokens' },
                    { to: '/patterns', label: 'Patterns' },
                  ]}
                />
              </CatalogSpecimen>
              <CatalogSpecimen label="Hover / focus states">
                <TabNav
                  tabs={[
                    { to: '/does-not-exist-a', label: 'Hover me' },
                    { to: '/does-not-exist-b', label: 'Tab me' },
                    { to: '/does-not-exist-c', label: 'Click me' },
                  ]}
                />
              </CatalogSpecimen>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function CatalogSpecimen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="catalog-specimen">
      <Text variant="body-sm" className="catalog-specimen-label">
        {label}
      </Text>
      <div className="catalog-specimen-stage">{children}</div>
    </div>
  );
}
