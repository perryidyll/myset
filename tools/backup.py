#!/usr/bin/env python3
"""A copy of the one datastore, somewhere Netlify is not — and a check that it is whole.

WHY THIS EXISTS
  Netlify Blobs is MySet's only datastore. Until 2026-09-12 there was no copy of it
  anywhere: not a snapshot, not an export, nothing. SECURITY.md said "nobody has
  tested a restore"; the truth was that there was nothing to restore from. Decision
  0046 sets the rhythm; this is the tool.

WHAT IT DOES
  Reads every key with the Netlify CLI (signed in as the site owner — the same
  read-only access tools/prod.py uses), writes each object's raw bytes to a dated
  folder, and writes a manifest with a size and a checksum per key. Then it checks
  the copy the way a restore would need it to be: every JSON document parses, and
  the registry agrees with the documents on disk.

  `netlify blobs:list` is the ONE place list() is allowed — this is not live data
  and minutes of lag do not matter (decision 0008, INVARIANT 1).

WHERE IT GOES
  $MYSET_BACKUP_DIR, default ~/Docs/Project Handoffs/myset-backups/ — outside the
  repo (so it can never be committed or published) and inside the folder that
  mirror-to-ssd.sh already carries to the SSD. The copy holds sign-in addresses and
  the ID-check photos, so the folder is created owner-only (0700). It is the most
  sensitive file the founder holds; treat it like one.

THE RHYTHM (decision 0046)
  · at the start of every working session, if the last copy is older than a week
    (`--if-stale`, run by the session-start checklist in AGENTS.md)
  · before every gig night (GIG-NIGHT.md)
  · keep 90 days; keep the first copy of each calendar month for a year (`--prune`)

usage
  python3 tools/backup.py               # take a copy now, verify it, prune old ones
  python3 tools/backup.py --if-stale    # only if the newest copy is over 7 days old
  python3 tools/backup.py --verify DIR  # re-check an existing copy
  python3 tools/backup.py --prune       # apply the retention rule and stop
  python3 tools/backup.py --dry-run     # list the keys and where the copy would go

RESTORE (decision 0069 — rehearsed 2026-09-14, see docs/sessions/2026-09-14-data-foundations.md)
  `--restore DIR --store NAME` writes every key in DIR's manifest into the named
  store with `netlify blobs:set --input`, reads each one back and compares its
  checksum, and REFUSES the production store by name: a restore into `myset`
  bypasses every etag and every invariant the functions enforce (INVARIANTS.md
  §5.2 rule 4 is why writes are re-read), and is done by a person, on the day the
  data is gone, by editing STORE below with somebody watching. The rehearsal store
  is a separate namespace on the same site — the functions only ever open `myset`
  — so a rehearsal touches nothing live. `--wipe NAME` deletes every key in the
  manifest from that store afterwards (again never `myset`). What a restore does
  NOT bring back: the `type` metadata on images (served as image/jpeg then —
  browsers sniff; the R2 mirror keeps the type) and anything written after the
  copy was taken. Ledger: Reliability & security b04.

  python3 tools/backup.py --restore DIR --store rehearsal-YYYYMMDD
  python3 tools/backup.py --wipe rehearsal-YYYYMMDD --from DIR
"""
import concurrent.futures
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys

STORE = 'myset'
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}
# the folder `netlify link` was run in — a worktree is not linked, so a session
# building elsewhere points this at the shared checkout
SITE_DIR = os.environ.get('MYSET_SITE_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.environ.get('MYSET_BACKUP_DIR') or os.path.expanduser('~/Docs/Project Handoffs/myset-backups')
STALE_DAYS = 7
WORKERS = 8
KEEP_DAYS = 90
KEEP_MONTHLY_DAYS = 365


def keys():
    r = subprocess.run(['netlify', 'blobs:list', STORE], capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    if r.returncode != 0:
        sys.exit('blobs:list failed — is the Netlify CLI signed in and the folder linked?\n' + r.stderr.strip())
    out = []
    for line in r.stdout.splitlines():
        if line.startswith('|') and '"' in line:
            out.append(line.split('|')[1].strip())
    return sorted(out)


def fname(key):
    # keys are flat (INVARIANT: prefix listing needs flat keys), but never trust a name on disk
    return key.replace('/', '%2F')


def fetch(key, path):
    r = subprocess.run(['netlify', 'blobs:get', STORE, key, '-O', path], capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    return r.returncode == 0 and os.path.exists(path)


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def copies():
    if not os.path.isdir(ROOT):
        return []
    return sorted(d for d in os.listdir(ROOT) if os.path.isfile(os.path.join(ROOT, d, 'manifest.json')))


def stamp_of(name):
    return datetime.datetime.strptime(name[:15], '%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)


def take():
    now = datetime.datetime.now(datetime.timezone.utc)
    name = now.strftime('%Y%m%dT%H%M%SZ')
    out = os.path.join(ROOT, name)
    os.makedirs(ROOT, mode=0o700, exist_ok=True)
    os.chmod(ROOT, 0o700)
    os.makedirs(os.path.join(out, 'keys'), mode=0o700)
    ks = keys()
    rows, failed = [], []

    def one(k):
        p = os.path.join(out, 'keys', fname(k))
        return k, fetch(k, p), p

    # each CLI call spends most of its time starting up, so run several at once
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for k, got, p in pool.map(one, ks):
            if got:
                rows.append({'key': k, 'bytes': os.path.getsize(p), 'sha256': sha(p)})
            else:
                failed.append(k)
    rows.sort(key=lambda r: r['key'])
    manifest = {'v': 1, 'store': STORE, 'taken': now.isoformat(), 'keys': len(ks), 'copied': len(rows), 'failed': failed, 'rows': rows}
    with open(os.path.join(out, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    total = sum(r['bytes'] for r in rows)
    print(f'copied {len(rows)} of {len(ks)} keys, {total/1e6:.1f} MB → {out}')
    if failed:
        print('FAILED to read:', ', '.join(failed))
    return out, not failed


def verify(out):
    """The checks a restore would need to pass. Returns True when the copy is whole."""
    with open(os.path.join(out, 'manifest.json')) as f:
        m = json.load(f)
    ok = True
    rows = {r['key']: r for r in m['rows']}

    # 1. every file is present and matches its checksum
    for k, r in rows.items():
        p = os.path.join(out, 'keys', fname(k))
        if not os.path.exists(p) or sha(p) != r['sha256']:
            print(f'  MISMATCH {k}'); ok = False

    # 2. every document parses as JSON — except images and clips, which are bytes, and
    #    the odd stray key a probe left behind (named, never fatal: a stray key is not
    #    something a restore needs, but a person should know it is there)
    docs, stray = {}, []
    for k in rows:
        if k.startswith(('img_', 'vid_')):
            continue
        p = os.path.join(out, 'keys', fname(k))
        try:
            with open(p, 'rb') as f:
                docs[k] = json.load(f)
        except (ValueError, UnicodeDecodeError):
            stray.append(k)
    if stray:
        print('  not JSON (stray keys, not app documents):', ', '.join(stray))

    # 3. the registry and the documents agree — the checks a sign-in and a show need
    reg = docs.get('artists')
    if not isinstance(reg, dict) or 'byId' not in reg:
        print('  the registry `artists` is missing or malformed'); ok = False
    else:
        by_id = reg.get('byId') or {}
        for aid in by_id:
            if f'show_{aid}' not in docs:
                print(f'  artist {aid} has no show_ document'); ok = False
        for slug, aid in (reg.get('bySlug') or {}).items():
            if aid not in by_id:
                print(f'  slug {slug} points at unknown artist {aid}'); ok = False
        for email, row in (reg.get('byEmail') or {}).items():
            aid = row.get('artistId') if isinstance(row, dict) else row
            if aid not in by_id:
                print(f'  an email row points at unknown artist {aid}'); ok = False
        print(f'  registry: {len(by_id)} artists, {len(reg.get("bySlug") or {})} slugs, {len(reg.get("byEmail") or {})} email rows')
    if 'authsecret' not in docs:
        print('  authsecret is missing — every session would be signed out on restore'); ok = False

    print(f'  {len(rows)} keys, {len(docs)} JSON documents, {len(rows) - len(docs) - len(stray)} binary, {len(stray)} stray')
    print('  copy is whole' if ok else '  COPY IS NOT WHOLE — do not rely on it')
    return ok


def prune():
    now = datetime.datetime.now(datetime.timezone.utc)
    kept_month = set()
    for name in copies():          # oldest first, so the first copy of a month wins
        t = stamp_of(name)
        age = (now - t).days
        month = t.strftime('%Y-%m')
        keep = age <= KEEP_DAYS or (month not in kept_month and age <= KEEP_MONTHLY_DAYS)
        if month not in kept_month:
            kept_month.add(month)
        if not keep:
            shutil.rmtree(os.path.join(ROOT, name))
            print(f'pruned {name} ({age} days)')


def put(store, key, path):
    r = subprocess.run(['netlify', 'blobs:set', store, key, '--input', path, '--force'],
                       capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    if r.returncode != 0 and not put.said:
        put.said = True
        print('  first write failure said:', (r.stderr or r.stdout).strip().splitlines()[-1:])
    return r.returncode == 0
put.said = False


def fetch_from(store, key, path):
    r = subprocess.run(['netlify', 'blobs:get', store, key, '-O', path], capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    return r.returncode == 0 and os.path.exists(path)


def drop(store, key):
    r = subprocess.run(['netlify', 'blobs:delete', store, key, '--force'], capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    return r.returncode == 0


def not_production(store):
    if not store or store == STORE:
        sys.exit(f'refusing: `{store or ""}` is the production store. A restore into it is a hand job for the day the data is gone — read the RESTORE note at the top of this file.')


def restore(src, store):
    """Write every key in src's manifest into `store`, read each back, compare. Timed."""
    not_production(store)
    with open(os.path.join(src, 'manifest.json')) as f:
        m = json.load(f)
    rows = m['rows']
    t0 = datetime.datetime.now(datetime.timezone.utc)
    print(f'restoring {len(rows)} keys from {src} into store `{store}`')
    bad_put, bad_read = [], []
    check = os.path.join(src, 'restore-check')
    os.makedirs(check, mode=0o700, exist_ok=True)

    def one(r):
        k = r['key']
        p = os.path.join(src, 'keys', fname(k))
        if not put(store, k, p):
            return k, 'put', None
        q = os.path.join(check, fname(k))
        if not fetch_from(store, k, q):
            return k, 'read', None
        return k, 'ok' if sha(q) == r['sha256'] else 'mismatch', q

    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for k, what, q in pool.map(one, rows):
            if what == 'put': bad_put.append(k)
            elif what != 'ok': bad_read.append(f'{k} ({what})')
            if q and os.path.exists(q): os.remove(q)
    shutil.rmtree(check, ignore_errors=True)
    secs = (datetime.datetime.now(datetime.timezone.utc) - t0).total_seconds()
    total = sum(r['bytes'] for r in rows)
    print(f'  {len(rows) - len(bad_put) - len(bad_read)} of {len(rows)} keys restored and read back equal, {total/1e6:.1f} MB, {secs:.0f} s')
    if bad_put: print('  FAILED to write:', ', '.join(bad_put))
    if bad_read: print('  READ BACK DIFFERENT:', ', '.join(bad_read))
    return not bad_put and not bad_read


def wipe(store, src):
    """Delete every key in src's manifest from `store` — the rehearsal's cleanup."""
    not_production(store)
    with open(os.path.join(src, 'manifest.json')) as f:
        rows = json.load(f)['rows']
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for k, okk in pool.map(lambda r: (r['key'], drop(store, r['key'])), rows):
            if not okk: failed.append(k)
    print(f'  deleted {len(rows) - len(failed)} of {len(rows)} keys from `{store}`')
    if failed: print('  FAILED to delete:', ', '.join(failed))
    return not failed


def newest_age_days():
    cs = copies()
    if not cs:
        return None
    return (datetime.datetime.now(datetime.timezone.utc) - stamp_of(cs[-1])).days


if __name__ == '__main__':
    args = sys.argv[1:]
    if '--verify' in args:
        d = args[args.index('--verify') + 1]
        sys.exit(0 if verify(d) else 1)
    if '--prune' in args:
        prune(); sys.exit(0)
    if '--restore' in args:
        d = args[args.index('--restore') + 1]
        st = args[args.index('--store') + 1] if '--store' in args else ''
        sys.exit(0 if restore(d, st) else 1)
    if '--wipe' in args:
        st = args[args.index('--wipe') + 1]
        d = args[args.index('--from') + 1] if '--from' in args else ''
        sys.exit(0 if wipe(st, d) else 1)
    if '--dry-run' in args:
        ks = keys()
        print(f'{len(ks)} keys would be copied to {ROOT}')
        sys.exit(0)
    if '--if-stale' in args:
        age = newest_age_days()
        if age is not None and age < STALE_DAYS:
            print(f'newest copy is {age} day(s) old — nothing to do')
            sys.exit(0)
        print('no copy in the last week' if age is not None else 'no copy exists yet')
    out, complete = take()
    whole = verify(out)
    prune()
    sys.exit(0 if (complete and whole) else 1)
