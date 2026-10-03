# Local Media Library preview repair

The local WordPress import has original images but lacks many generated thumbnail
files. Attachment metadata still refers to those missing files, causing blank
previews in the Media Library.

Copy `creative-hatti-local-media-preview.php` into the local installation's
`wp-content/mu-plugins` directory. It activates automatically and only affects
admin attachment responses on `creativehatti.test` or `www.creativehatti.test`.
Missing image sizes use the original image; existing thumbnail files are kept.

This does not write to the database, regenerate files, change public API
responses, alter product downloads, or affect the production domain. Originals
can be larger than thumbnails. Delete the single MU-plugin file to undo the
repair. Fully restore the thumbnails from a backup or regenerate them later if
native small previews are needed.
