import { PetApp } from './pet/PetApp.js';

const app = new PetApp();
app.init();

window.addEventListener('beforeunload', () => app.dispose());
