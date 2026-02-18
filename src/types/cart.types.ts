export interface Cart {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddToCartInput {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export interface CartItemWithDetails extends CartItem {
  variant: {
    id: string;
    sku: string;
    name: string | null;
    priceCents: number;
    product: {
      id: string;
      name: string;
      organizationId: string;
      organization: {
        id: string;
        name: string;
        slug: string;
      };
    };
  };
}

export interface CartResponse {
  id: string;
  items: CartItemWithDetails[];
  totalItems: number;
  totalPriceCents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartSummary {
  itemCount: number;
  uniqueVendors: number;
  totalPriceCents: number;
}