# Ballot Brain AZ

A nonpartisan voter guide and AI chat engine for the **November 3, 2026 General Election** ballot in **Pima County, Arizona (Legislative District 17, Congressional District 6, Precinct 192 ballot style)**.

- **`/`** is the engine. Voters ask about any candidate or proposition in their own words and get the record, both sides, and a 0-100 fit score based on their own priorities.
- **`/guide`** is the guide. It covers every race in ballot order, a side-by-side compare tool with per-category match scores, all 13 propositions (official YES/NO language plus both sides), judges, how and when to vote, and a fact-check of the campaign mail.

It never tells anyone how to vote. Every candidate position used for scoring is tied to a cited source.

## 1. Put it on GitHub with GitHub Desktop

1. Unzip `ballot-brain-az.zip`. You get a folder named `ballot-brain-az`. It is already a Git repository on branch `main`, with no commits yet.
2. Open **GitHub Desktop**, then choose **File → Add local repository…** and pick the `ballot-brain-az` folder. It opens directly; there's no "create a repository" step.
3. In the bottom-left, type the Summary `Initial commit` and click **Commit to main**.
4. Click **Publish repository**. Keep **"Keep this code private"** ticked, then click **Publish repository**.
5. On github.com, open the repo, go to **Settings → Code security**, and turn on **Secret scanning** and **Push protection**.

## 2. Deploy on Vercel

1. In Vercel, click **Add New… → Project** and import the `ballot-brain-az` repository. Framework preset: **Other**. No build command is needed.
2. Before or after the first deploy, go to **Settings → Environment Variables** and add `ANTHROPIC_API_KEY` for **Production**. Get the key from a **dedicated Claude Console workspace** for this project, with a monthly spend limit and spend alerts. Use a separate low-limit key (or none) for Preview.
3. Optional: `ANTHROPIC_MODEL` overrides the default model, `claude-sonnet-5-5`. `ALLOWED_ORIGINS` adds a custom domain, for example `https://ballotbrain.example.org`.
4. **Redeploy** after adding variables.
5. Add the firewall rate-limit rule (**Firewall → Configure → New Rule**): path `/api/chat`, Fixed Window 600 seconds, 20 requests, keyed by IP, action 429. This matches the in-code limiter.

Until the key is set, the chat answers with "The planner isn't set up yet." The guide works without it.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html`, `assets/engine.*` | The engine (home page) |
| `guide/index.html`, `assets/guide.*` | The guide, rendered from the data file |
| `assets/prefs.js` | Theme toggle and text-size selector shared by both pages |
| `data/gub.json` | All guide content: 38 candidates, 13 propositions, how-to-vote, judges, mail fact-check, scoring statements, sources |
| `api/chat.js` | Serverless function that holds the API key, picks the relevant guide entries, and calls Claude |
| `vercel.json` | Function settings (includes `data/**`) and security headers / Content-Security-Policy |

## Updating the content

Edit `data/gub.json`. Each entry has `id`, `title`, `summary`, `body`, `tags` and `details`. Candidates also carry `record`, `supporters_point_to`, `critics_point_to`, `sources`, and `stances`.

`stances` maps a statement id (from `categories`) to `[position, sourceId, note]`. The position is `1` (agrees), `-1` (disagrees) or `0` (unclear). Only add a stance when a source documents it. Every source id must exist in `sources`.

If you change the inline theme script in either HTML file, recompute its SHA-256 hash and update `script-src` in `vercel.json`, or the page will block it.

## Security notes

- The API key lives only in Vercel environment variables. Browser code only ever calls `/api/chat`.
- `/api/chat` accepts POST only, with a JSON body of 32 KB at most, and up to 24 messages of 4,000 characters each, using only the user and assistant roles. The server alone sets the model, `max_tokens` (16000), effort and system prompt.
- Requests whose `Origin` isn't this site get a 403. That blocks other websites, but not scripts, so it doesn't replace the rate limit or the Console spend cap.
- An in-code limiter allows 20 requests per 10 minutes per IP, best effort per instance. The Vercel Firewall rule is the durable limit.
- The upstream timeout is 50 s, under the function's 60 s `maxDuration`.
- Errors are generic, and logs record status codes only.
- All model and user text is rendered with `textContent`. There are no third-party scripts besides Google Fonts.

## Accuracy

Facts were checked against the sources listed in the guide as of **October 17, 2026**. Campaign mailers are treated as claims to verify, not facts. Where a candidate has no documented position, the guide says so instead of guessing. Voters should confirm details at [arizona.vote](https://www.arizona.vote) and [recorder.pima.gov](https://recorder.pima.gov).
