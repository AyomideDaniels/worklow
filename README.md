# Worklow — frames, styles, and motion prompts

Worklow is a creative workspace for filmmakers and AI artists. Turn a reference image into a styled frame, organise it in a storyboard, and generate motion prompts tailored to MiniMax H3, Kling, or Seedance. Midjourney prompts support selectable style-reference codes and thumbnails.

**Live application:** https://ayomide-frameflow.ayomidedaniels-eth.chatgpt.site

The hosted app is currently private. Reviewers need an invitation from the owner; this repository does not grant app access. You can also run your own local copy below.

## Try the complete workflow

1. Open **Settings** and choose **Keyless** or **PymtHouse** connection mode. Keyless is the default.
2. Open **Style Replikator**, upload a reference image and select a style.
3. Review the image cost estimate, then click **Replikate**.
4. Review the generated image in the gallery and choose **Save to storyboard**.
5. Choose a project and folder, then **Save & open frame**.
6. Choose **Analyse frame**, review or edit the description, and enter the intended movement and camera direction.
7. Generate a prompt for the selected model and copy it into that model's generation service.

Worklow generates styled images and prompts. It does not render video or submit prompts directly to Midjourney, MiniMax, Kling, or Seedance.

Other features include video frame extraction, storyboard projects and folders, a reference library, custom Midjourney style codes and thumbnails, and reusable style profiles imported from JSON, Markdown, TXT, ZIP or .skill files. Style profiles and gallery items added by users live in their browser, not in this repository. The creator tested importing a custom LEGO profile; it is not a built-in style in a fresh installation.

## Run locally

Requires **Node.js 22 or newer**. No third-party npm dependencies or install step are needed.

```sh
git clone https://github.com/AyomideDaniels/worklow.git
cd worklow
npm run dev
```

Open **http://127.0.0.1:3000**. Choose **Settings → Keyless** to use the provider's demo access without a key. Demo availability, allowance and eligibility are controlled by Livepeer; keyless access is not unlimited or a permanent production funding plan.

### Optional PymtHouse connection

Copy `.env.example` to `.env` and enter your own credentials locally:

```dotenv
DAYDREAM_API_KEY=your_pymthouse_credential
PYMTHOUSE_CLIENT_ID=your_matching_app_client_id
```

`DAYDREAM_API_KEY` retains its historical name. For a bare `pmth_` key, the server combines a configured matching `app_` client ID with it; an already-composite credential is passed through unchanged. Restart the local server after changing `.env`, then choose **PymtHouse** in Settings. Credentials stay on the server and must never be committed.

Connection mode is saved in the browser. Keyless omits the upstream Authorization header. Worklow never silently switches modes after a failed request; pending image jobs retain their original mode. PymtHouse authentication was rejected during recent development testing, while keyless succeeded. An active dashboard key alone does not establish that inference access works.

## How Livepeer powers Worklow

The browser calls Worklow's server, which invokes Livepeer Agent MCP. Reference analysis, prompt writing and image restyling depend on those tool calls.

| Product action | Livepeer tool and purpose |
| --- | --- |
| Upload a reference or style anchor | `upload` through Creative MCP |
| Analyse a frame | `critique_batch` through Creative MCP for visual observations |
| Generate model-specific prompts | `run_capability` with `gemini-text` through Raw MCP |
| Restyle an image | `run_capability` with `gpt-image-edit` through Raw MCP, source plus optional style anchors |
| Check image progress | `get_create_media` through Creative MCP |
| Estimate image cost | `get_pricing` before a new render |

Endpoints used by this source:

- https://agent.livepeer.org/api/mcp/creative
- https://agent.livepeer.org/api/mcp/raw

Analysis adapts the two-asset review tool by supplying the same reference twice and asking for visual observations. It is not a dedicated captioning API, and the requested description is concise. Failed or unavailable vision results are rejected. The text model then receives the description and the user's shot direction, rather than inspecting the original image itself. Users can correct the analysis before generating prompts.

Prompt profiles use different writing conventions for each model: timed performance direction for MiniMax, subject-first motion descriptions for Kling, and Scene/Action/Camera sections for Seedance. These are editorial conventions, not assertions of exclusive model capabilities or a guarantee of downstream output.

Style Replikator requests preservation of source composition while applying the selected profile. Exact identity, composition and style matching are not guaranteed. The built-in GTA-inspired profile is an independent creative preset, not an official affiliation.

## Reliability and cost handling

- Image generation requires an explicit click after pricing is checked; unavailable or out-of-range prices prevent a new render.
- Render requests carry an idempotency key. Pending request and job identifiers are kept so a manual retry can recover the same request.
- Read-only pricing and status operations get one retry for eligible transient failures. Paid submissions are never automatically retried by the client.
- A failed pricing check leaves **Retry connection** available. Returning to the tab or regaining connectivity rechecks pricing.
- Confirmed terminal failures release the render controls. Releasing a stuck local request does not cancel the job at Livepeer.
- Generated images are copied to browser storage when possible. The gallery uses browser Blob links for opening and downloading saved images.

Provider moderation, outages, expired sessions and allowances can still prevent completion. Estimates are not billing guarantees. A session requiring sign-in cannot be fixed simply by retrying generation.

## Storage and privacy

Projects, images, imported profiles, analyses and prompts are stored in IndexedDB in the current browser. Use workspace backups for portability. There is no cross-device account sync; clearing browser data can remove this local work.

Reference images and visual style anchors are sent to Livepeer when processing is requested. Provider image links can expire; recover any failed local image copy promptly. No personal workspace data, API keys, or generated-image gallery is included in this source export.

The local server binds to loopback by default. The hosted installation relies on Sites access control. Do not expose an account-funded installation publicly without adding suitable authentication, per-user authorization and usage limits.

## Build and verification

```sh
npm test
npm run build
```

The test command builds and runs **13 tests** covering connection modes, request validation, vision-result handling, prompt output contracts, and recovery from transient responses and failed pricing. These tests mock upstream responses; they do not run paid generation or establish current provider availability.

The creator has manually reported successful analysis, prompt generation, restyling, custom LEGO profile import, and gallery-to-storyboard use. The latest recovery changes have automated regression coverage; long-idle behaviour still needs a real-session check.

`npm run build` creates a Worker-compatible `dist/server/index.js` with embedded frontend assets.

## Source map

| Location | Responsibility |
| --- | --- |
| `public/app.js` | Workspace, storyboard and main interface |
| `public/replikator.js` | Style selection, upload, pricing and render lifecycle |
| `public/profile-import.js` | Custom profile and skill-package import |
| `public/replikator-gallery.js` | Generated-image gallery, local downloads and storyboard transfer |
| `public/prompt-agent.js` | Analysis/prompt requests and bounded read recovery |
| `public/connection-mode.js` | Browser-selected connection mode |
| `server/worker.js` | Server routes, credentials, MCP calls and restricted image retrieval |
| `server/direct-prompts.js` | Vision analysis and model-specific prompt construction |
| `server/replikator.js` | Image editing request construction |
| `tests/` | Automated regression checks |

## Hackathon contribution and provenance

Worklow began as a frame/storyboard and prompt workspace before this Livepeer integration effort. Work in this effort includes Livepeer analysis and prompt integration, model-specific prompting, custom style references, storyboard folder improvements, Style Replikator, imported profiles, generated-image gallery and storyboard transfer, pricing checks, connection-mode selection, and failure recovery.

This is not a claim that the entire product was created during the event. Track choice, pre-existing work eligibility, reviewer access and the demo recording should be confirmed before the final submission.

## Deployment and license

This portable source export omits the live project's hosting identifier. `.openai/hosting.json` contains only an empty object to support the existing build. Provision your own hosting configuration to deploy a separate installation; do not overwrite the live site's configuration with this placeholder.

The software is provided under the existing [MIT license](LICENSE). User references, built-in visual examples and generated media require their own applicable rights review; the software license does not grant third-party asset rights.
