import { endpoint, HttpError } from "../http";
import { graphql } from "../shopify";

// A raw numeric id or the full GID
const PRODUCT_ID_PATTERN = /^(gid:\/\/shopify\/Product\/)?\d+$/;

export default endpoint({
  "GET /api/products/search": async (ctx) => {
    const query = typeof ctx.query.q === "string" ? ctx.query.q : "";

    const data = await graphql(
      ctx,
      `query SearchProducts($query: String!) {
        products(first: 10, query: $query) {
          edges {
            node {
              id
              title
              handle
              status
              featuredImage { url }
              variants(first: 1) {
                edges { node { id price } }
              }
              priceRangeV2 {
                minVariantPrice { amount currencyCode }
              }
            }
          }
        }
      }`,
      { query },
    );

    const products = data.products.edges.map(({ node }: any) => ({
      id: node.id,
      title: node.title,
      handle: node.handle,
      status: node.status,
      image: node.featuredImage?.url || null,
      variantId: node.variants.edges[0]?.node.id || null,
      price: node.priceRangeV2?.minVariantPrice?.amount,
      currency: node.priceRangeV2?.minVariantPrice?.currencyCode,
    }));

    return { products };
  },

  "GET /api/products/:id": async (ctx) => {
    const { id } = ctx.params;
    if (!PRODUCT_ID_PATTERN.test(id)) throw new HttpError(400, "Invalid product id");
    const gid = id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;

    const data = await graphql(
      ctx,
      `query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          description
          status
          vendor
          productType
          tags
          totalInventory
          priceRangeV2 {
            maxVariantPrice { amount currencyCode }
            minVariantPrice { amount currencyCode }
          }
          featuredImage { url altText }
          images(first: 5) {
            edges { node { url altText } }
          }
          variants(first: 20) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions { name value }
              }
            }
          }
        }
      }`,
      { id: gid },
    );

    if (!data.product) throw new HttpError(404, "Product not found");
    return { product: data.product };
  },
});
