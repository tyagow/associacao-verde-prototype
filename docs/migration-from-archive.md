# Migration From Archived Reference Data

The archived browser-only reference pages are not the production system. To
migrate reference data, export browser state as JSON and import it into the production
SQLite database.

## Archived Ordering Reference

In the browser console on the archived `archived-ordering-reference.html` page:

```js
copy(localStorage.getItem("apoio-reserva-archive"));
```

Save that JSON to a local file such as:

```text
tmp/ordering-reference-export.json
```

Then run:

```bash
node scripts/import-archive.mjs tmp/ordering-reference-export.json data/associacao-verde.sqlite
```

## Archived Operations Reference

In the browser console on the archived `index.html` reference page:

```js
copy(localStorage.getItem("associacao-verde-state"));
```

Save that JSON to a local file, then run the same import command.

## What The Import Does

- Imports products into the production `products` table.
- Imports patients when patient records exist.
- Creates patient records for legacy orders when needed.
- Imports legacy orders as `imported_confirmed`.
- Imports stock entries and cultivation batches when present.
- Writes an audit event named `archive_imported`.

The import does not create live payment records with provider settlement data.
Imported orders are historical references and should be reconciled by the team
before they are used for financial reporting.
