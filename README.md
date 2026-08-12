# siski.buzz

A tiny public buzz appliance for fake warnings, terminal omens, local guestbook residue, hidden doors, and mildly cursed browser behavior.

This is a dependency-free static site intended to be hosted from GitHub Pages.

## Pages Setup

1. Create or use a GitHub repository.
2. Push these files to the repository root.
3. In GitHub, open `Settings -> Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose `main` and `/root`.
6. Add the custom domain `siski.buzz`.

The `CNAME` file is already included for the custom domain.

## Local Preview

```bash
python -m http.server 4177
```

Then open:

```text
http://127.0.0.1:4177/
```

## Secret Handles

Try these:

- Console command: `siski`
- Console command: `secret`
- Type `buzz` anywhere
- Visit `archive.html`, `hive.html`, and `secret.html`

## Notes

The guestbook and counters use `localStorage`; nothing is sent anywhere. The sound toggle uses Web Audio and stays off until clicked.
