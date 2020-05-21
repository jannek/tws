# Trailing Whitespace (TWS)

Highlight and trim trailing whitespace.

## Features

All trailing whitespace can be decorated with red highlight.
Trailing whitespace can be trimmed upon saving the file, but only from lines user has modified.

## Extension Settings

This extension contributes the following settings, all machine-overridable:

* `tws.trimOnSave`: enable/disable trimming the whitespace when saving document
* `tws.highlightTrailingWhiteSpace`: enable/disable highlighting of trailing whitespace
* `tws.highlightOnlyChangedLines`: enable/disable highlighting of trailing whitespace only on changed lines
* `tws.debugLog`: enable/disable debug log channel

## References

* [jsdiff](https://www.npmjs.com/package/diff) is used to find modified lines
