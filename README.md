# Forest Civil Works Database – Amrabad Tiger Reserve

A single-page website (`index.html`) for the ATR civil works register.

- **Data:** read live from the `works` tab of the civil-works Google Sheet every time the page opens (the sheet must stay shared as "anyone with the link can view"). If the sheet can't be reached, a built-in snapshot is shown.
- **Photos:** the `Photo_url` column holds Google Drive links; the site shows Drive thumbnails.
- **Views:** dashboard charts, Google satellite map, works with photos (cards/table, CSV), and reports (cross-tab abstract + statement of works, print/PDF/CSV).
- **Filters:** division, range, section, beat, scheme, year, structure and free-text search, applied to every view.

To add works, add rows to the Google Sheet with the same columns. No change to the site is needed.

Hosted with GitHub Pages from the `main` branch.
