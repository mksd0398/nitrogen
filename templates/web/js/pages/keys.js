/**
 * API keys page logic
 * Create, list and revoke the keys outside systems authenticate with.
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", loadKeys);

  // ── List ────────────────────────────────────────────────────────
  async function loadKeys() {
    showLoading("key-list");
    try {
      var data = await apiFetch("/api/keys");
      renderKeys(data.keys || []);
    } catch (err) {
      showError("key-list", err.message);
    }
  }

  function renderKeys(keys) {
    var el = document.getElementById("key-list");
    if (keys.length === 0) {
      el.innerHTML = '<s-text color="subdued">No keys yet.</s-text>';
      return;
    }

    el.innerHTML =
      '<s-stack gap="base">' +
      keys
        .map(function (key) {
          var used = key.lastUsedAt ? "last used " + formatDate(key.lastUsedAt) : "never used";
          return (
            '<s-stack direction="inline" gap="base" alignItems="center">' +
            '<s-text fontWeight="semibold">' + escapeHtml(key.name) + "</s-text>" +
            "<s-text>" + escapeHtml(key.hint) + "…</s-text>" +
            '<s-badge tone="' + (key.active ? "success" : "critical") + '">' +
            (key.active ? escapeHtml(key.scope) : "revoked") +
            "</s-badge>" +
            '<s-text color="subdued">created ' + formatDate(key.createdAt) + ", " + used + "</s-text>" +
            (key.active
              ? '<s-button tone="critical" variant="tertiary" onclick="revokeKey(\'' +
                escapeAttr(key.id) + "')\">Revoke</s-button>"
              : "") +
            "</s-stack>"
          );
        })
        .join("") +
      "</s-stack>";
  }

  // ── Create ──────────────────────────────────────────────────────
  window.createKey = async function createKey() {
    var field = document.getElementById("key-name");
    var created = document.getElementById("key-created");
    try {
      var data = await apiFetch("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: field.value }),
      });
      field.value = "";
      created.innerHTML =
        '<s-banner tone="success">' +
        "<s-text>" +
        '<s-text fontWeight="semibold">Copy this key now.</s-text> It will not be shown again. ' +
        "<code>" + escapeHtml(data.key.key) + "</code>" +
        "</s-text></s-banner>";
      loadKeys();
    } catch (err) {
      showToast("Could not create the key: " + err.message, true);
    }
  };

  // ── Revoke ──────────────────────────────────────────────────────
  window.revokeKey = async function revokeKey(id) {
    try {
      await apiFetch("/api/keys/" + encodeURIComponent(id), { method: "DELETE" });
      showToast("Key revoked");
      loadKeys();
    } catch (err) {
      showToast("Could not revoke the key: " + err.message, true);
    }
  };
})();
