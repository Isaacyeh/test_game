import { setSprite, setMenuOpen } from "../script_files/player.js";

let spritesData = [];

async function loadSprites() {
  try {
    const response = await fetch('/sprites.json');
    spritesData = await response.json();
  } catch (error) {
    console.error('Failed to load sprites.json:', error);
  }
}

function createSpriteMenu(resolve, onConfirm) {
  const menu = document.getElementById('spriteMenu');
  menu.innerHTML = `
    <h2>Select Your Character</h2>
    <div id="spriteGrid"></div>
    <div>
      <label for="customSprite">Or upload custom image:</label>
      <input type="file" id="customSprite" accept="image/*">
    </div>
    <button id="confirmSprite">Confirm</button>
  `;
  setMenuOpen(true);
  menu.classList.remove('hidden');

  const grid = menu.querySelector('#spriteGrid');
  spritesData.forEach((sprite, index) => {
    const container = document.createElement('div');
    container.className = 'sprite-item';
    
    const img = document.createElement('img');
    img.src = sprite.url;
    img.alt = sprite.name;
    img.className = 'sprite-option';
    img.addEventListener('click', () => {
      setSprite(sprite.url);
      document.querySelectorAll('.sprite-option').forEach(el => el.classList.remove('selected'));
      img.classList.add('selected');
    });
    
    const nameLabel = document.createElement('p');
    nameLabel.className = 'sprite-name';
    nameLabel.textContent = sprite.name;
    
    container.appendChild(img);
    container.appendChild(nameLabel);
    grid.appendChild(container);
  });

  const fileInput = menu.querySelector('#customSprite');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSprite(reader.result);
        document.querySelectorAll('.sprite-option').forEach(el => el.classList.remove('selected'));
      };
      reader.readAsDataURL(file);
    }
  });

  const confirmBtn = menu.querySelector('#confirmSprite');
  confirmBtn.addEventListener('click', () => {
    setMenuOpen(false);
    menu.classList.add('hidden');
    // Focus the canvas to enable keyboard controls
    const canvas = document.getElementById('game');
    if (canvas) {
      canvas.tabIndex = 0;
      canvas.focus();
    }
    if (typeof onConfirm === 'function') {
      onConfirm();
    }
    resolve(); // Resolve the promise when confirmed
  });
}

export async function showSpriteMenu(onConfirm) {
  await loadSprites();
  return new Promise((resolve) => {
    createSpriteMenu(resolve, onConfirm);
  });
}