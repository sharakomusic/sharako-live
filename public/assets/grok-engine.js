/* Call → real line. Do not change her. */
(function () {
  var NUMBER = "+14452968787";
  function dial() {
    try {
      if (window.AndroidVoice && typeof window.AndroidVoice.dial === "function") {
        window.AndroidVoice.dial(NUMBER);
        return true;
      }
    } catch (_) {}
    window.location.href = "tel:" + NUMBER;
    return true;
  }
  window.__sharakoGrokStop = function () {};
  window.__sharakoGrok = async function () {
    return dial();
  };
})();
