export interface ChApiEnvelope<TData> {
  success: boolean;
  data: TData;
  pagination?: ChApiPagination;
}

export interface ChApiPagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ChApiMoney {
  type?: "single" | "variable";
  amount: number;
  formatted?: string;
  currency: string;
}

export interface ChApiTerm {
  id: number;
  name: string;
  slug: string;
}

export interface ChApiImage {
  id: number;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface ChApiProductCard {
  id: number;
  title: string;
  slug: string;
  price: ChApiMoney;
  image?: ChApiImage | null;
  categories?: ChApiTerm[];
  featured?: boolean;
  file_type?: string | null;
  file_size?: string | null;
}

export interface ChApiVariablePrice {
  id?: number | string;
  name?: string;
  amount?: number;
  formatted?: string;
  currency?: string;
}

export interface ChApiProductDetail extends ChApiProductCard {
  status?: string;
  date?: string;
  modified?: string;
  description?: string | null;
  short_description?: string | null;
  variable_prices?: ChApiVariablePrice[];
  featured_image?: ChApiImage | null;
  gallery?: ChApiImage[];
  tags?: ChApiTerm[];
  compatible_with?: string | null;
  documentation?: boolean | string | null;
}

export interface ChApiCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  count?: number;
  parent?: number;
  image_url?: string;
  image?: ChApiImage | null;
}
