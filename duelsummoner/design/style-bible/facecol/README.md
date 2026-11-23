# Face colour lists (Carved Cards re-bake)

One `<model>.facecol.json` per finished model: `palette` (hex, locked palette only) and `index` (base64, one byte per triangle, in the order of the first primitive's index buffer). The game draws each triangle in that flat colour and drops the model's texture.

How they were made (`tag.py`): the texture is sampled at four points per face, faces are clustered by colour (k-means in OKLab, hue weighted), each cluster is tagged with one palette ramp (automatic, then hand overrides in `CFG`), and a face's step on the ramp follows its lightness inside the cluster. Blind nearest-colour mapping was tried first and fails (skin turns scarf orange, hair picks up coat teal, canopy undersides turn to bark).

Not judged in the game yet. The model files themselves are not in the repo.
