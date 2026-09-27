/**
 * Reference pages (Components and App Bridge): the Copy buttons.
 */

(function () {
  "use strict";

  window.copyCode = function (button) {
    var container = button.closest(".demo-code");
    var code = container && container.querySelector("code");
    if (!code) return;

    navigator.clipboard.writeText(code.textContent).then(
      function () {
        var original = button.textContent;
        button.textContent = "Copied!";
        button.classList.add("copied");
        setTimeout(function () {
          button.textContent = original;
          button.classList.remove("copied");
        }, 2000);
      },
      function () {
        showToast("Could not copy to the clipboard", true);
      },
    );
  };
})();
