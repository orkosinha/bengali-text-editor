# Bengali HTML editor

A small web-based text editor for [the Sri Ramakrishna and Swami Vivekananda website](https://www.ramakrishnavivekananda.info/). This editor is purpose-built for my dad’s workflow maintaining the website with [KompoZer](https://kompozer.app/). Some older pages declare ISO-8859-1 (Latin-1) as their file encoding and store Bengali letters as numeric HTML references. For example, `&#2486;` represents the Unicode character শ. This editor preserves KompoZer behavior, where the Bengali references are rendered instead of the decimal content. I could not find an editor that partially renders this kind of content. This project is entirely AI-generated.

--

Run `npm start` with Node.js 22 or later and open the printed local address. The editor runs from the checked-in files, including the optional folder browser, Avro input, and diff library. Installing development dependencies is only necessary to rebuild the bundles.

Open a directory to browse its HTML pages, or choose **Open from live** and enter an archive URL. Pages open in tabs with independent edits, cursor positions, and undo histories. Select several files in the explorer to open them together. **Save HTML** downloads a copy. Click text in the edited preview to move the source caret there. Preview links open a matching local page when available, and **Open original in new tab** opens the published website. The preview renders document content with reader styling.

The live file tree grows from links on pages you visit. Local folders are listed one level at a time when the browser supports directory handles. The fallback picker lists HTML paths up front. Both read file contents when you open a page. Search covers the paths discovered so far.

**Published** and **Diff** compare against a fetched copy of the published HTML. For local files the editor assumes the opened folder is the website root. Change the comparison URL and choose **Load** if the folder starts deeper in the archive. Drag the divider or focus it and use the arrow keys to resize the panes.

The static files also work directly from disk or on GitHub Pages for local editing. The static editor requests published HTML directly. When the archive restricts cross-origin reads, it opens a read-only browser view. Running the included server enables live editing and comparison.
