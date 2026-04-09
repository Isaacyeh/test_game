import { setIsChatting, getState } from "./player.js";
 
export function setupChat(ws, chatInput, chat, sendBtn, username) {
  // ── Image upload button (injected next to sendBtn) ──────────────────────
  const imageLabel = document.createElement("label");
  imageLabel.htmlFor = "chatImageInput";
  imageLabel.textContent = "📎";
  imageLabel.title = "Upload image or GIF";
  imageLabel.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    cursor: pointer;
    font-size: 16px;
    padding: 4px 0;
    flex-shrink: 0;
  `;
 
  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.id = "chatImageInput";
  // Accept all image types including GIF explicitly
  imageInput.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
  imageInput.style.display = "none";
 
  // Insert label + hidden input after sendBtn
  sendBtn.parentNode.insertBefore(imageLabel, sendBtn.nextSibling);
  sendBtn.parentNode.insertBefore(imageInput, imageLabel.nextSibling);
 
  // ── Text message sending ─────────────────────────────────────────────────
  function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    ws.send(JSON.stringify({ type: "chat", message: msg }));
    chatInput.value = "";
    chatInput.blur();
  }
 
  ws.addEventListener("open", () => {
    const { sprite } = getState();
    ws.send(JSON.stringify({ type: "setName", name: username }));
    ws.send(JSON.stringify({ type: "setSprite", sprite }));
  });
 
  sendBtn.addEventListener("click", sendMessage);
 
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  chatInput.addEventListener("focus", () => setIsChatting(true));
  chatInput.addEventListener("blur",  () => setIsChatting(false));
 
  document.addEventListener("keydown", (e) => {
    if (e.key === "/") chatInput.focus();
  });
 
  // ── Image upload sending ─────────────────────────────────────────────────
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
 
    // Cap to 1.5 MB before encoding — base64 adds ~33% overhead making it ~2 MB
    if (file.size > 1_500_000) {
      alert("Image too large — please upload something under 1.5 MB.");
      imageInput.value = "";
      return;
    }
 
    const reader = new FileReader();
    reader.onload = () => {
      const imageData = reader.result; // data URL (base64)
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "chatImage", imageData }));
      }
      imageInput.value = ""; // reset so the same file can be re-sent
    };
    reader.readAsDataURL(file);
  });
 
  // ── Incoming messages ────────────────────────────────────────────────────
  ws.addEventListener("message", (e) => {
    const data = JSON.parse(e.data);
 
    if (data.type === "chat") {
      const div = document.createElement("div");
      div.textContent = `${data.name}: ${data.message}`;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
    }
 
    if (data.type === "chatImage") {
      const wrapper = document.createElement("div");
 
      const nameSpan = document.createElement("span");
      nameSpan.textContent = `${data.name}: `;
      nameSpan.style.color = "#aaa";
 
      const img = document.createElement("img");
      img.src = data.imageData;
      img.style.cssText = `
        display: block;
        max-width: 100%;
        max-height: 160px;
        margin-top: 4px;
        border-radius: 4px;
        cursor: pointer;
      `;
      // Click to open full-size in a new tab
      img.addEventListener("click", () => {
        window.open(data.imageData, "_blank");
      });
 
      wrapper.appendChild(nameSpan);
      wrapper.appendChild(img);
      chat.appendChild(wrapper);
      chat.scrollTop = chat.scrollHeight;
    }
  });
}