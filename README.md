# Prog renfo

Application web (PWA) de programmation force et détente : Vite + React 19 + TypeScript, données dans IndexedDB (Dexie), 100 % hors ligne et locale. Interface en français, kg, mode sombre, pensée pour une main.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173/prog-renfo/
```

Le chemin de base est `/prog-renfo/` par défaut. Pour un autre chemin : `VITE_BASE=/ npm run dev`.

## Tests et build

```bash
npm test           # tests du moteur (vitest)
npm run typecheck  # tsc -b --noEmit
npm run build      # build de production dans dist/
npm run preview    # sert dist/ en local
```

## Publier sur GitHub Pages, pas à pas

1. Crée un dépôt GitHub nommé `prog-renfo` (vide, sans README).
2. Dans le dossier du projet :
   ```bash
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/prog-renfo.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Le workflow `.github/workflows/deploy.yml` se lance à chaque push sur `main` (ou à la main via **Actions → Deploy to GitHub Pages → Run workflow**) : il installe, lance `npm test`, construit puis publie `dist/`.
5. Quand le job est vert, l'app est sur `https://<ton-compte>.github.io/prog-renfo/`.

### Dépôt avec un autre nom

Le `base` de Vite vaut `/prog-renfo/` par défaut. Si ton dépôt s'appelle autrement, ajoute `VITE_BASE` dans le job `build` du workflow :

```yaml
  build:
    runs-on: ubuntu-latest
    env:
      VITE_BASE: /autre-nom/
```

(avec les slashs de début et de fin). Sans ça, la page reste blanche et le manifeste PWA pointe au mauvais endroit.

## Ajouter à l'écran d'accueil iPhone

1. Ouvre l'adresse de l'app dans **Safari** (pas Chrome).
2. Touche **Partager** (carré avec une flèche).
3. Choisis **Sur l'écran d'accueil**, puis **Ajouter**.

L'app s'ouvre ensuite en plein écran et fonctionne hors ligne après le premier chargement.

## Exporter / importer les données

Tout est stocké localement sur l'appareil (IndexedDB). iOS peut purger les données d'un site peu utilisé : exporte régulièrement.

- **Exporter** : onglet **Réglages → Exporter mes données**. Un fichier `prog-renfo-AAAA-MM-JJ.json` est téléchargé (séances, mesures, photos en base64, réglages). Un rappel apparaît tous les 14 jours.
- **Importer** : **Réglages → Importer une sauvegarde**, choisis le fichier JSON et confirme. Attention : cela **remplace** toutes les données locales.
- **Changer de programme** : **Réglages → Importer un nouveau program.json** (par exemple pour construire le macrocycle 4). Le journal est conservé ; **Revenir au programme embarqué** annule.
