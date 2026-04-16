import { Icon, Text } from '@wordpress/ui';
import { home, archive } from '@wordpress/icons';
import AppHeader from './AppHeader';
import { MenuItem } from '../components';

function SiteIcon({ name, src }: { name: string; src?: string }) {
  return (
    <span className="site-icon" aria-hidden="true">
      {src ? <img src={src} alt="" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
}

// Tiny inline SVG data-URIs so the "with image" specimens don't hit the network.
const demoImageA =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23b2a1ff"/><text x="12" y="16" font-family="sans-serif" font-size="13" font-weight="600" fill="white" text-anchor="middle">A</text></svg>';
const demoImageB =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23ff9f5c"/><text x="12" y="16" font-family="sans-serif" font-size="13" font-weight="600" fill="white" text-anchor="middle">W</text></svg>';

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
