/* The outside watch's clock (decision 0208).
 *
 * .github/workflows/watch.yml is MySet's outside check (0157) and the release of a
 * production build held while a show was live (0196). Its own five-minute schedule
 * is a request GitHub honours when it is not busy: 35 runs between 2 and 10 October 2026,
 * three to seven hours apart. Cloudflare's cron keeps time, so every five minutes
 * this asks GitHub to run that workflow now. The workflow decides everything; this
 * only rings. GitHub's own schedule stays as the backstop for when Cloudflare is down.
 *
 * When GitHub refuses (the token expired or was revoked, the workflow was renamed),
 * the founder's phone hears it through ntfy, at most once every six hours. */

const DISPATCH = 'https://api.github.com/repos/perryidyll/myset/actions/workflows/watch.yml/dispatches';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ring(env, event.scheduledTime));
  },
};

async function ring(env, when) {
  let why;
  if (!env.GH_DISPATCH_TOKEN) why = 'the Worker has no GH_DISPATCH_TOKEN secret';
  else {
    try {
      const r = await fetch(DISPATCH, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': 'myset-watch-clock',
          'x-github-api-version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) return;
      why = `GitHub answered ${r.status}: ${(await r.text()).slice(0, 200)}`;
    } catch (e) {
      why = `GitHub did not answer: ${e && e.message || e}`;
    }
  }
  console.log(why);
  // The tick at :00 of 00, 06, 12 and 18 UTC speaks; the other 71 a day only log.
  const t = new Date(when);
  if (!env.NTFY_TOPIC || t.getUTCHours() % 6 || t.getUTCMinutes() >= 5) return;
  await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: 'The MySet watch clock is not ringing', Priority: 'high' },
    body: `${why}. The outside watch now runs only when GitHub's own schedule fires, hours apart. See cloudflare/clock (decision 0208).`,
    signal: AbortSignal.timeout(15000),
  }).catch(() => {});
}
