# Bengali HTML editor

Run `npm start` with Node.js 22 or later and open the printed local address. The editor runs from the checked-in files, including the optional folder browser, Avro input, and diff library. Installing development dependencies is only necessary to rebuild the bundles.

Open a directory to browse its HTML pages, or choose **Open from live** and enter an archive URL. Pages open in tabs with independent edits, cursor positions, and undo histories. Select several files in the explorer to open them together. **Save HTML** downloads a copy. Click text in the edited preview to move the source caret there. Preview links open a matching local page when available, and **Open original in new tab** opens the published website. The preview renders document content with reader styling.

The live file tree grows from links on pages you visit. Local folders are listed one level at a time when the browser supports directory handles. The fallback picker lists HTML paths up front. Both read file contents when you open a page. Search covers the paths discovered so far.

**Published** and **Diff** compare against a fetched copy of the published HTML. For local files the editor assumes the opened folder is the website root. Change the comparison URL and choose **Load** if the folder starts deeper in the archive. Drag the divider or focus it and use the arrow keys to resize the panes.

The static files also work directly from disk or on GitHub Pages for local editing. Live loading and comparison use the included server because the archive does not grant cross-origin access to its HTML.
