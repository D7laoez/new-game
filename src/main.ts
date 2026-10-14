import './styles/main.css';
import { PartyApp } from './ui/PartyApp.ts';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    new PartyApp(root);
  }
});
