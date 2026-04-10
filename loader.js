// loader.js — visual loading screen ONLY.
// Does NOT open WebSockets or touch any game logic.
// Exposes window.__loader so script.js can drive the progress bar/status
// and call dismiss() when the connection is confirmed open.
 
(function () {
  const style = document.createElement("style");
  style.textContent = `
    #game-loader {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: #0a0a0a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', monospace;
      color: #fff;
      transition: opacity 0.5s ease;
    }
    #game-loader.fade-out {
      opacity: 0;
      pointer-events: none;
    }
    #game-loader::before {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 2px,
        rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px
      );
      pointer-events: none;
    }
    .gl-title {
      font-size: clamp(26px, 5.5vw, 54px);
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #fff;
      text-shadow: 0 0 28px rgba(119,136,153,0.9), 0 0 56px rgba(119,136,153,0.4);
      margin-bottom: 10px;
      position: relative;
    }
    .gl-sub {
      font-size: 11px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: #778899;
      margin-bottom: 52px;
    }
    .gl-bar-wrap {
      width: min(400px, 78vw);
      height: 5px;
      background: rgba(255,255,255,0.07);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 18px;
      border: 1px solid rgba(119,136,153,0.2);
    }
    .gl-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #778899, #b0c4d8);
      border-radius: 3px;
      transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 0 10px rgba(119,136,153,0.5);
    }
    .gl-status {
      font-size: 11px;
      letter-spacing: 0.18em;
      color: #778899;
      min-height: 16px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .gl-retry-info {
      font-size: 10px;
      color: #444;
      letter-spacing: 0.1em;
      min-height: 14px;
    }
    .gl-error {
      margin-top: 28px;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .gl-error.show { display: flex; }
    .gl-error-msg {
      color: #cc4444;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-align: center;
      max-width: 340px;
      line-height: 1.7;
    }
    .gl-retry-btn {
      padding: 9px 26px;
      background: transparent;
      border: 1px solid #778899;
      color: #ddd;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s, box-shadow 0.2s;
    }
    .gl-retry-btn:hover {
      background: rgba(119,136,153,0.18);
      box-shadow: 0 0 10px rgba(119,136,153,0.35);
    }
    body.game-loading > *:not(#game-loader) {
      visibility: hidden;
    }
  `;
  document.head.appendChild(style);
 
  const el = document.createElement("div");
  el.id = "game-loader";
  el.innerHTML = `
    <div class="gl-title">PROJECT ALPHA</div>
    <div class="gl-sub">Loading</div>
    <div class="gl-bar-wrap"><div class="gl-bar" id="gl-bar"></div></div>
    <div class="gl-status" id="gl-status">Starting...</div>
    <div class="gl-retry-info" id="gl-retry-info"></div>
    <div class="gl-error" id="gl-error">
      <div class="gl-error-msg" id="gl-error-msg"></div>
      <button class="gl-retry-btn" id="gl-retry-btn">Retry</button>
    </div>
  `;
 
  function inject() {
    document.body.classList.add("game-loading");
    document.body.insertBefore(el, document.body.firstChild);
  }
  if (document.body) { inject(); } else { document.addEventListener("DOMContentLoaded", inject); }
 
  function gid(id) { return document.getElementById(id); }
 
  // Public API — called by script.js
  window.__loader = {
    setProgress: function(pct, msg) {
      var b = gid("gl-bar");    if (b) b.style.width = pct + "%";
      var s = gid("gl-status"); if (s) s.textContent = msg;
    },
    setRetryInfo: function(msg) {
      var r = gid("gl-retry-info"); if (r) r.textContent = msg;
    },
    showError: function(msg, onRetry) {
      var s = gid("gl-status");    if (s) s.textContent = "Connection failed";
      var e = gid("gl-error");     if (e) e.classList.add("show");
      var m = gid("gl-error-msg"); if (m) m.textContent = msg;
      var b = gid("gl-retry-btn"); if (b) b.onclick = function() {
        var er = gid("gl-error"); if (er) er.classList.remove("show");
        onRetry();
      };
    },
    dismiss: function() {
      var l = gid("game-loader");
      if (!l) return;
      document.body.classList.remove("game-loading");
      l.classList.add("fade-out");
      setTimeout(function() { if (l.parentNode) l.parentNode.removeChild(l); }, 550);
    }
  };
})();