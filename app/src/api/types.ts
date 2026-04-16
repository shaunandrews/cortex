export interface WPComUser {
  ID: number;
  display_name: string;
  username: string;
  email: string;
  avatar_URL: string;
  profile_URL: string;
  site_count: number;
}

export interface WPComSite {
  ID: number;
  name: string;
  description: string;
  URL: string;
  icon?: {
    img: string;
  };
  options?: {
    is_wpforteams_site?: boolean;
  };
  meta?: {
    links?: {
      site: string;
    };
  };
}

export interface WPComSitesResponse {
  sites: WPComSite[];
}
