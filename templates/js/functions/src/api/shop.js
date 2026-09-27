const { endpoint } = require("../http");
const { graphql } = require("../shopify");

module.exports = endpoint({
  "GET /api/shop": async (ctx) => {
    const data = await graphql(
      ctx,
      `{
        shop {
          name
          email
          myshopifyDomain
          url
          primaryDomain { url host }
          plan { displayName partnerDevelopment shopifyPlus }
          currencyCode
          ianaTimezone
          billingAddress { country countryCodeV2 }
        }
        productCount: productsCount { count }
      }`,
    );

    return { shop: { ...data.shop, productCount: data.productCount } };
  },
});
