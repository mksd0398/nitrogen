/**
 * App Bridge page: the code behind each Run button.
 *
 * GENERATED from tools/reference/apis.js by `npm run build:reference` in the
 * Nitrogen repository. In your own project this is an ordinary file: edit it
 * freely, or delete the page once you no longer need the reference.
 */

(function () {
  "use strict";

  var demos = {
    "config": async function (show) {
      show({
        shop: shopify.config.shop,
        locale: shopify.config.locale,
        apiKey: shopify.config.apiKey,
      });
    },

    "environment": async function (show) {
      const { embedded, mobile, pos } = shopify.environment;
      show({ embedded, mobile, pos });
    },

    "id-token": async function (show) {
      const token = await shopify.idToken();

      const response = await fetch("/api/status", {
        headers: { Authorization: "Bearer " + token },
      });
      show(await response.json());
    },

    "fetch": async function (show) {
      // Your own backend: the token is attached for you
      const mine = await fetch("/api/status");
      show(await mine.json());

      // The Admin API, directly. Needs in shopify.app.toml:
      //   [access.admin]
      //   embedded_app_direct_api_access = true
      const admin = await fetch("shopify:admin/api/graphql.json", {
        method: "POST",
        body: JSON.stringify({ query: "{ shop { name } }" }),
      });
      show(await admin.json());
    },

    "scopes": async function (show) {
      const { granted, required, optional } = await shopify.scopes.query();
      show({ granted, required, optional });

      // Ask when the merchant reaches the feature that needs it:
      //   const result = await shopify.scopes.request(["read_orders"]);
      //   result.result === "granted-all" or "declined-all"
      //
      // Give one back:
      //   await shopify.scopes.revoke(["read_orders"]);
    },

    "user": async function (show) {
      const user = await shopify.user();
      show(user);
    },

    "app": async function (show) {
      const extensions = await shopify.app.extensions();
      show(extensions);
    },

    "toast": async function (show) {
      shopify.toast.show("Product saved");

      shopify.toast.show("Product archived", {
        duration: 5000,
        action: "Undo",
        onAction: () => shopify.toast.show("Restored"),
      });

      // For a failure
      shopify.toast.show("Could not save", { isError: true });
    },

    "loading": async function (show) {
      shopify.loading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      shopify.loading(false);
    },

    "modal": async function (show) {
      await shopify.modal.show("api-modal");

      // await shopify.modal.hide("api-modal");
      // await shopify.modal.toggle("api-modal");
    },

    "navigation": async function (show) {
      // From JavaScript, inside the app
      open("/settings", "_self");

      // To a page of the admin:
      //   open("shopify://admin/products", "_top");
    },

    "resource-picker": async function (show) {
      const selected = await shopify.resourcePicker({
        type: "product", // or "variant", "collection"
        multiple: 3,     // true for any number, a number for a limit
        filter: { variants: false, draft: false },
      });

      show(selected ? selected.map((p) => ({ id: p.id, title: p.title })) : "Cancelled");
    },

    "picker": async function (show) {
      const picker = await shopify.picker({
        heading: "Choose a template",
        multiple: false,
        headers: [{ content: "Template" }, { content: "Uses", type: "number" }],
        items: [
          { id: "welcome", heading: "Welcome email", data: ["12"], badges: [{ content: "Live", tone: "success" }] },
          { id: "restock", heading: "Back in stock", data: ["3"] },
        ],
      });

      show(await picker.selected);
    },

    "intents": async function (show) {
      const activity = await shopify.intents.invoke("create:shopify/Collection");
      const response = await activity.complete;

      // response.code is "ok", "closed" or "error"
      show(response);

      // To edit an existing resource:
      //   shopify.intents.invoke("edit:shopify/Product", { value: "gid://shopify/Product/123" });
    },

    "reviews": async function (show) {
      const result = await shopify.reviews.request();

      // result.success is false with a code such as "already-reviewed"
      // or "annual-limit-reached" when Shopify chose not to show it
      show(result);
    },

    "support": async function (show) {
      await shopify.support.registerHandler(() => {
        open("https://example.com/help", "_blank");
      });
      show("Registered. It runs when the merchant asks for support.");
    },

    "tools": async function (show) {
      shopify.tools.register("get_app_status", async () => {
        const response = await fetch("/api/status");
        return response.json();
      });
      show("Registered get_app_status");

      // shopify.tools.unregister("get_app_status");
      // shopify.tools.clear();
    },

    "print": async function (show) {
      print();
    },

    "share": async function (show) {
      try {
        await navigator.share({
          text: "Have a look at this",
          url: "https://" + shopify.config.shop,
        });
        show("Shared");
      } catch (error) {
        show("Not shared: " + error.message);
      }
    },

    "scanner": async function (show) {
      if (!shopify.environment.mobile && !shopify.environment.pos) {
        show("The scanner needs Shopify Mobile or Point of Sale");
        return;
      }

      const { data } = await shopify.scanner.capture();
      show(data);
    },

    "pos": async function (show) {
      if (!shopify.environment.pos) {
        show("Open the app in Shopify Point of Sale to use this");
        return;
      }

      show(await shopify.pos.device());

      // await shopify.pos.cart.addLineItem(40202439393345, 1);
      // await shopify.pos.cart.applyCartDiscount("FixedAmount", "Staff discount", "10");
      // await shopify.pos.cart.clear();
      // await shopify.pos.close();
    },

    "web-vitals": async function (show) {
      await shopify.webVitals.onReport((report) => {
        // Send report.metrics wherever you keep measurements
        console.log(report.metrics);
      });
      show("Registered. Reports arrive as the page is measured.");
    },
  };

  window.runDemo = async function runDemo(id) {
    var output = document.getElementById("output-" + id);
    var lines = [];
    function show(value) {
      lines.push(typeof value === "string" ? value : JSON.stringify(value, null, 2));
      output.textContent = lines.join("\n");
      output.hidden = false;
    }

    if (!window.shopify) {
      show("Open the app in the Shopify admin to run this.");
      return;
    }
    try {
      await demos[id](show);
    } catch (error) {
      show("Failed: " + (error && error.message ? error.message : error));
    }
  };
})();
