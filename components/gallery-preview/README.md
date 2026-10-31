# Gallery preview rollback

This experiment adds the `/gallery-preview` route without entering the main navigation, sitemap, or public index. To remove it, delete `app/gallery-preview/` and `components/gallery-preview/`, then remove the `galleryPreview` helper from `lib/routes.ts`. No WordPress data or existing storefront components need to be reverted.

Files created: `app/gallery-preview/page.tsx`, `app/gallery-preview/page.module.css`, `components/gallery-preview/GalleryPreview.tsx`, `components/gallery-preview/GalleryPreview.module.css`, `components/gallery-preview/justified-layout.mjs`, `components/gallery-preview/justified-layout.d.mts`, `components/gallery-preview/README.md`, and `tests/gallery-preview.test.mjs`. The only existing file modified is `lib/routes.ts`, to register the prototype route centrally.
