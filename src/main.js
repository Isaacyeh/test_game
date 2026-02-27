// main.js
// entry point for the client; wires modules together and starts the game loop

import { initInput } from "./input.js";
import { initChat } from "./chat.js";
import { initNetwork } from "./network.js";
import { setUsername, player } from "./player.js";
import { loop } from "./render.js";

window.addEventListener("DOMContentLoaded", () => {
  // prompt the user for a name
  let name = prompt("Enter your username:") || "Anonymous";
  name = name.trim() || "Anonymous";
  setUsername(name);

  initInput();
  initChat();
  initNetwork();

  // start render/update loop
  loop();
});
