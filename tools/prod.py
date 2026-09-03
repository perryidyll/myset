#!/usr/bin/env python3
"""Look at LIVE production state, read-only, without needing anyone's password.

WHY THIS EXISTS
  Perry asked, reasonably, why the person who built the system needs his login to
  see what it is doing. He doesn't. The Netlify CLI on this machine is already
  signed in as the site owner, and `netlify blobs:get` reads the production data
  store directly. That is full owner-level READ access to everything the app has
  ever stored, and it is how the app should be diagnosed.

  What it is NOT is a way to act as an artist. The HTTP admin door needs either a
  signed-in session or the ADMIN_CODE recovery key, and the recovery key CANNOT be
  read back: Netlify marks it `is_secret: true` and the API returns a mask, not the
  value. An earlier session mistook that mask for the real key, got a 401, and
  wrongly concluded the recovery key was broken. It is not broken — it is simply
  unreadable by design, which is the correct behaviour for a recovery key. If a
  write against production is genuinely needed, ask Perry to run it, or use
  `netlify blobs:set` deliberately and say so out loud first.

usage
  python3 tools/prod.py            # the health report
  python3 tools/prod.py keys       # every key in the store
  python3 tools/prod.py get <key>  # one document, pretty-printed
"""
import json, os, subprocess, sys

STORE = 'myset'
ENV = {**os.environ, 'PATH': os.environ['HOME'] + '/.local/node/bin:' + os.environ.get('PATH', '')}
SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def blob(key):
    r = subprocess.run(['netlify', 'blobs:get', STORE, key],
                       capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    if r.returncode != 0:
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return r.stdout.strip() or None


def keys():
    r = subprocess.run(['netlify', 'blobs:list', STORE],
                       capture_output=True, text=True, env=ENV, cwd=SITE_DIR)
    out = []
    for line in r.stdout.splitlines():
        if line.startswith('|') and '"' in line:
            out.append(line.split('|')[1].strip())
    return out


def report():
    ks = keys()
    artists = blob('artists') or {}
    idq = (blob('idqueue') or {}).get('by', {})
    print('WHO IS ON THE PLATFORM')
    by = artists.get('byId', {})
    if not by:
        print('  nobody yet')
    for aid, a in by.items():
        conn = blob(f'connect_{aid}')
        print(f"  {a.get('name', aid)}  (page: myset.vip/{a.get('slug', '?')})")
        print(f"    plan ............. {a.get('plan', 'free')}"
              + (f"  (comped with {a['compedBy']})" if a.get('compedBy') else ''))
        print(f"    verified tick .... {'YES' if a.get('verified') else 'no'}")
        print(f"    ID on file ....... {'yes' if f'img_{aid}_idcheck' in ks else 'no'}")
        q = idq.get(aid)
        if q:
            print(f"    ID request ....... {q.get('state')}"
                  f"  legal name given: {'yes' if q.get('legalName') else 'NO (old upload)'}"
                  f"  name match: {q.get('nameMatch') or 'not compared'}"
                  f"  birth date: {'matches' if q.get('dobMatch') is True else 'does NOT match' if q.get('dobMatch') is False else 'not compared'}")
        print(f"    getting paid ..... "
              + ('not started — no Stripe account' if not conn else
                 f"cards {'LIVE' if conn.get('chargesEnabled') else 'off'}, "
                 f"payouts {'on' if conn.get('payoutsEnabled') else 'off'}"))
        print(f"    songs ............ {len(((blob(f'show_{aid}') or {}).get('songs') or []))}")

    print('\nWHAT IS STORED, BY KIND')
    kinds = {}
    for k in ks:
        # vote shards use ~ as their separator, everything else uses _ or /
        kind = k.split('~')[0].split('_')[0].split('/')[0] or 'vote'
        kinds[kind] = kinds.get(kind, 0) + 1
    for k, n in sorted(kinds.items(), key=lambda x: -x[1]):
        print(f'  {k:<14} {n}')
    print(f'  {"TOTAL":<14} {len(ks)}')

    print('\nTHINGS WORTH KNOWING')
    print('  spreadsheet export .. there is NO Google Sheet and never was;'
          ' nothing is mirrored outside Netlify')
    if not any(k.startswith('connect_') for k in ks):
        print('  Stripe Connect ...... no artist has started it, so nothing can'
              ' auto-verify and no artist can take money yet')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'report'
    if cmd == 'keys':
        for k in keys():
            print(k)
    elif cmd == 'get':
        print(json.dumps(blob(sys.argv[2]), indent=1))
    else:
        report()
