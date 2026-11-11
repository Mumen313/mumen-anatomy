# Mumen Anatomy – website

The website is built automatically from Notion and hosted free on GitHub Pages.

```
Notion (you write)  →  GitHub Actions (builds every 3 h, or on demand)  →  GitHub Pages (public website)
```

- **Content** lives in Notion under the page *Mumen Anatomy*: the **Topics** database, **About Me**, **Website settings** and the region pages.
- **Design and code** live in this repository. You can change them yourself on github.com or ask Claude.
- **Costs:** none. GitHub, GitHub Pages and the Notion API are free.

## One-time setup (about 15 minutes)

1. **GitHub account.** Create a free account at github.com.
2. **Repository.** Create a new repository called `mumen-anatomy` and upload all files from this folder (or connect GitHub to Claude and let Claude push them).
3. **Notion key.** Open notion.so/profile/integrations → *New integration* → name it *Mumen Anatomy Website*, type *Internal*, capability **Read content** only → *Save* → copy the *Internal Integration Secret*.
4. **Give the key access.** In Notion open the page *Mumen Anatomy* → ⋯ (top right) → *Connections* → add *Mumen Anatomy Website*.
5. **Store the key in GitHub.** Repository → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*: name `NOTION_TOKEN`, value = the secret from step 3.
6. **Switch on Pages.** Repository → *Settings* → *Pages* → *Source*: **GitHub Actions**.
7. **First build.** Repository → *Actions* → *Build website from Notion* → *Run workflow*. After ~1 minute the site is live at `https://YOUR-USERNAME.github.io/mumen-anatomy/`.

## Everyday use

| You want to… | Do this |
| --- | --- |
| Add a topic | In Notion, duplicate *Topic Template* inside **Topics**, fill it, set **Status = Published**. |
| Change text | Edit it in Notion. The site updates within 3 hours. |
| Update right now | GitHub → *Actions* → *Build website from Notion* → *Run workflow* (or ask Claude). |
| Hide a topic | Set its Status back to *Draft*. |
| Add your logo | Upload it on the Notion page *Website settings*. |
| Write about yourself | Write on the Notion page *About Me*. |
| Change colours / fonts | Edit the top of `assets/style.css` (the `:root` block), or ask Claude. |

**Private notes:** callouts with ✍️, ⚖️, 🔒 or 🌐 icons, and the *Publishing checklist* toggle, never appear on the website.

## Media folder on your Desktop

Create a folder `Mumen Anatomy Media` on your Desktop with one sub-folder per topic, named like the topic's **Slug**:

```
Mumen Anatomy Media/
  logo.png                 ← your logo
  me.jpg                   ← photo for About me
  brachial-plexus/
    video.mp4              ← or video-link.txt with a YouTube link
    cadaver-1.jpg
    cadaver-1.txt          ← optional caption, e.g. "Cords around the axillary artery – anterior view"
    cadaver-2.jpg
    reference-1.jpg
    histology-1.jpg
```

Tell Claude "add the new media" and it places each file in the right section of the Notion page. The website picks it up at the next build.

**Videos:** Notion's free plan accepts uploads up to 5 MB, so full videos go on **YouTube** (free; *Unlisted* if you don't want them public) and only the link goes into Notion. The website embeds it in the *My video explanation* chapter.

## Special parts

- `components/<slug>.html` – extra interactive content placed at the top of a topic's *Reference images* section (example: the clickable brachial plexus diagram).
- `site.config.json` – region names and default texts.
- `test/run.mjs` – offline test with fake Notion data: `node test/run.mjs`.

## Later: membership

Members' login can be added without monthly fees (e.g. a free Supabase account for logins, and Stripe for payments, which only takes a fee per payment). The *Membership* page already explains the plan.
