# LYCA Product Administration

Separate private frontend for managing the LYCA website catalogue. Products, images and settings live in the main catalogue service; this app has no duplicate database.

Required runtime environment names are in `.env.example`. Set `ADMIN_EMAIL` to the approved signed-in administrator. `CATALOGUE_ORIGIN` points to the main LYCA site. Keep `CATALOGUE_SERVICE_TOKEN` and `ADMIN_BRIDGE_KEY` as server-only hosting secrets. Never place these in browser variables or source.

The product editor supports adding, editing and archiving catalogue entries and uploading JPEG, PNG and WebP images. Contact settings configure EmailJS public values and an approved response-time message. No password/private EmailJS keys should be entered there.


The customer website now uses the uploaded LYCA design at https://lyca-food-ingredients.suderramesh541.chatgpt.site/ . Customer links open that main website; previous `/customer/` links redirect there and retain their page path and query. The shared catalogue backend uses Neon PostgreSQL.
