// Branded SweetAlert2 helpers for TelePlus Care.
// Loaded after sweetalert2.all.min.js, before each page's own script.
(function () {
  const BRAND = "#6366f1";
  const DANGER = "#ef4444";
  const NEUTRAL = "#64748b";

  function hasSwal() {
    return typeof window.Swal !== "undefined";
  }

  window.tpAlert = {
    success(title, text) {
      if (!hasSwal()) {
        return Promise.resolve();
      }
      return Swal.fire({
        icon: "success",
        title,
        text: text || "",
        confirmButtonColor: BRAND,
        confirmButtonText: "OK"
      });
    },

    error(title, text) {
      if (!hasSwal()) {
        return Promise.resolve();
      }
      return Swal.fire({
        icon: "error",
        title: title || "Something went wrong",
        text: text || "",
        confirmButtonColor: BRAND,
        confirmButtonText: "OK"
      });
    },

    // Returns a promise resolving to true if the user confirmed.
    confirm(title, text, confirmText) {
      if (!hasSwal()) {
        return Promise.resolve(window.confirm(text || title));
      }
      return Swal.fire({
        icon: "warning",
        title,
        text: text || "",
        showCancelButton: true,
        confirmButtonColor: DANGER,
        cancelButtonColor: NEUTRAL,
        confirmButtonText: confirmText || "Yes",
        cancelButtonText: "Cancel",
        reverseButtons: true
      }).then((result) => result.isConfirmed);
    },

    // Small non-blocking toast in the corner.
    toast(title, icon) {
      if (!hasSwal()) {
        return Promise.resolve();
      }
      return Swal.fire({
        toast: true,
        position: "top-end",
        icon: icon || "success",
        title,
        showConfirmButton: false,
        timer: 2600,
        timerProgressBar: true
      });
    }
  };
})();
