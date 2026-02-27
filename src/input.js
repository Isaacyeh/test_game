// input.js
// keyboard state and chat focus tracking

export const keys = {};
export let isChatting = false;

export function initInput() {
  window.onkeydown = (e) => (keys[e.key] = true);
  window.onkeyup = (e) => (keys[e.key] = false);
  document.addEventListener("keydown", (e) => {
    // slash opens chat
    if (e.key === "/") {
      const chatInput = document.getElementById("chatInput");
      chatInput.focus();
    }
  });
}

export function setChatting(state) {
  isChatting = state;
}
