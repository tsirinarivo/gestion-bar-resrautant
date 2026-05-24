# Import de données réelles — Mode d'emploi

Ce dossier contient les templates CSV pour passer en utilisation réelle.

## Étapes

1. **Copier les templates dans `import-data/`** :
   ```bash
   mkdir -p ./import-data
   cp deploy/import-templates/*.csv ./import-data/
   ```

2. **Éditer chaque CSV** avec tes vraies données (Excel, LibreOffice, ou éditeur texte).
   ⚠️ **Garder la première ligne (les headers) intacte.**

3. **Lancer l'import** :
   ```bash
   bash deploy/import-real-data.sh
   ```
   Le script va :
   - Demander l'email + mot de passe du compte **admin réel**
   - Faire un backup pré-import
   - Wipe la base (drop + recreate schéma)
   - Créer les rôles système
   - Créer l'admin
   - Importer tes 5 CSV
   - Smoke test final

## Fichiers attendus dans `./import-data/`

| Fichier | Contenu | Lignes attendues |
|---|---|---|
| `restaurant.csv` | Infos de TON restaurant | 1 seule ligne (après header) |
| `categories.csv` | Catégories du menu | autant que nécessaire |
| `products.csv` | Plats / boissons | autant que nécessaire |
| `tables.csv` | Tables du plan de salle | autant que nécessaire |
| `employees.csv` | Comptes employés | autant que nécessaire |

## Formats

### restaurant.csv
- `slug` : identifiant unique URL-friendly (ex: `mon-resto`) — sera utilisé dans les URLs publiques
- `currency` : `MGA` pour Ariary, `EUR` pour Euro
- `defaultTaxRate` : taux de TVA en % (ex: `20`)
- `deliveryEnabled` : `true` ou `false`
- `*_open` / `*_close` : horaires au format `HH:MM` (laisser vide si fermé)

### categories.csv
- `slug` : ID URL-friendly (ex: `entrees`, `plats`)
- `sortOrder` : ordre d'affichage (1, 2, 3...)
- `icon` : un emoji (ex: 🍛)
- `color` : code hex (ex: `#f59e0b`)

### products.csv
- `categorySlug` : doit correspondre à un slug de `categories.csv`
- `price` : prix en unité de la devise (ex: `18000` pour 18 000 Ar)
- `taxRate` : TVA en % (généralement 20)
- `kdsStation` : `hot` | `cold` | `drinks` | `desserts`
- `prepTime` : temps de préparation en minutes
- `isAvailable` : `true` (en vente) ou `false` (rupture)

### tables.csv
- `number` : numéro unique de la table (entier)
- `capacity` : nombre de places
- `section` : `Salle principale` | `Terrasse` | `Bar` | etc.
- `shape` : `rectangle` | `circle` | `square`

### employees.csv
- `role` : `manager` | `caissier` | `serveur` | `cuisinier`
- `password` : mot de passe initial (employé peut le changer ensuite)
- ⚠️ Utilise des mots de passe forts en production

## En cas d'erreur

Restaurer le backup créé avant l'import :
```bash
bash deploy/restore-postgres.sh
# Puis sélectionner le fichier pre-import-*.sql.gz
```
