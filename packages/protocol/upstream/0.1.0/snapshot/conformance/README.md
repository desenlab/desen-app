# DESEN Conformance Vectors

`vectors.json` lists starter validation cases for DESEN 0.1.0.

Each vector declares:

- `file` — path relative to this directory;
- `target` — `source`, `bundle`, or `catalog`;
- `expect` — `valid` or an error class; and
- `code` — expected stable diagnostic code when invalid.

The current set covers:

- valid source, bundle, and catalog documents;
- unknown closed-core fields;
- duplicate node identity;
- unknown capabilities and events;
- bundle revision mismatch; and
- exact catalog digest mismatch.

Run from the repository root:

```bash
python tools/validate.py --suite
```

This is a starter suite, not a complete conformance certification. New normative behavior should add at least one positive and one negative vector where applicable.
