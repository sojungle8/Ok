# Skill VFX production boundary

This directory is only for manually authored Survivors skill effects allowed by D-032. It may not
contain characters, monsters, maps, UI, audio, copied RO Survivors / HANS material, or AI-generated
art.

- Editable artist files stay outside Git in the rights-controlled art archive; the manifest stores
  an opaque `external-art-archive:` reference, never a local absolute path.
- Reviewed PNG exports live under `output/` and no companion source file is committed.
- Every export must have one approved entry in `manifest.json`, exact source/output hashes, rights
  evidence, reproduction steps and the RO-style review fields required by the schema.
- An empty manifest is valid. Missing art continues to use the existing engine gameplay geometry;
  it is never silently replaced with unreviewed art.
