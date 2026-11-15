# Real photos the scanner got wrong

Every photo here is one the owner took on a phone and the scanner failed on (cropped from the
screenshots he sent, so they are at about the size the scanner works on). `labels.json` says which
card each one is and when it failed. They are the proof set: a scanner change is not "Pass"
until all of them name their card.

    npm run test:scanner-real

runs the real site scanner (photo mode, a real browser, the real text reader) over them and exits
1 if any photo does not name its card. `twin2.jpg` needs a connection: its name cannot be read, so
the scanner checks the picture's nearest cards against their rules text online.

When a new photo fails for the owner, add it here with a line in `labels.json`.
