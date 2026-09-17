# Worklow — frames, styles, and motion prompts

Worklow is a creative workspace for filmmakers and AI artists. It connects reference images, reusable visual styles, storyboard projects, and model-specific prompts through Livepeer Agent MCP.

## Main workflow

1. Upload an image to **Style Replikator** and select a visual profile.
2. Review the displayed estimate and click **Replikate**.
3. Review the generated image in the gallery, then **Save to storyboard**.
4. Select a project and folder and **Save & open frame**.
5. **Analyse frame**, review or edit the description, and describe the intended movement.
6. **Generate prompt** for MiniMax H3, Kling, Seedance, or Midjourney.
7. Copy the prompt into the target generation service. Worklow does not render video.

Other features include video frame extraction into storyboard folders, custom Midjourney style-reference codes and thumbnails, and reusable style profiles imported from JSON, Markdown, text, ZIP, or .skill files.

## Run locally

Requires Node.js 22. No third-party npm dependencies are needed.

1. Copy `.env.example` to `.env`.
2. Set `DAYDREAM_API_KEY` to your own PymtHouse credential. The variable retains its historical name. For a bare `pmth_` key, also set `PYMTHOUSE_CLIENT_ID` to the matching `app_` client ID. Already-composite credentials are used unchanged.
3. Run `npm run dev`.
4. Open http://127.0.0.1:3000.

Never put credentials in the browser code or commit `.env`. Each installation needs its own working account and credits. No automatic keyless fallback is used.

## How Livepeer powers the product

The browser calls Worklow's server. The server keeps the credential private and invokes Livepeer's MCP tools.

| Feature | Integration |
| --- | --- |
| Reference upload | `upload` on the Creative MCP endpoint |
| Frame analysis | `critique_batch` obtains visual observations; the same image is supplied twice to adapt its two-asset review interface |
| Model-specific prompts | `run_capability` with `gemini-text` on Raw MCP, using the analysis and user's shot direction |
| Style Replikator | `run_capability` with `gpt-image-edit` on Raw MCP, with the source image and up to two style anchors |
| Render progress | `get_create_media` on Creative MCP |
| Image cost estimate | `get_pricing` before image generation |

Endpoints: `https://agent.livepeer.org/api/mcp/creative` and `https://agent.livepeer.org/api/mcp/raw`.

Frame analysis uses the review tool rather than a dedicated captioning API. The text model receives the resulting description, not the reference image. Source composition is requested during restyling, but exact preservation is not guaranteed.

Generation requests use idempotency keys. An uncertain request can be checked without deliberately starting a new render. Confirmed failures unlock the controls. **Reset stuck request** releases the local request; it does not cancel a provider-side render. Images are copied through a restricted download endpoint and stored locally for storyboard use.

## Storage, access, and limitations

- Projects, images, profiles, analyses, and prompts are stored in IndexedDB in the current browser. Use **Backup** and **Import** to move them between devices. There is no account-based sync.
- References and profile anchors are uploaded to Livepeer for processing. Provider availability, moderation, pricing, and output quality can affect results.
- Successful generated images are saved locally when the download succeeds. Provider links can expire; a failed local copy should be recovered promptly.
- The hosted installation is private. A repository link does not give reviewers access to that installation or its local projects.
- The local development server binds to loopback. Public deployment requires authentication, user authorization, and spending limits; the API uses the installation owner's credits.
- Built-in visual samples and user-imported references are separate from the software license. Verify the rights needed for any public showcase or redistribution.

## Build and verification

`npm run build` creates a Cloudflare Worker-compatible `dist/server/index.js` with embedded frontend assets. `npm test` builds and runs the existing contract tests with mocked upstream responses; it does not run paid image generation or prove provider availability.

The creator has reported completing a manual test of the current feature set. During development, the image-download endpoint was also verified against an actual generated image. Third-party output quality still needs human review.

## Hackathon contribution and provenance

Worklow existed as a frame/storyboard and prompt workspace before this Livepeer integration effort. Work completed in this effort includes the Livepeer analysis and prompt integration, model-specific prompting, custom style references, storyboard folder improvements, Style Replikator, imported visual profiles, generated-image gallery and storyboard transfer, pricing checks, and render-failure recovery.

This is a source snapshot, not an assertion that the entire product was created during the hackathon. The creator should confirm the final contribution description against the organiser's eligibility rules before submission. Track selection remains to be confirmed.

## Deployment portability

The source export intentionally omits the live project's hosting identifier and all credentials. `.openai/hosting.json` is an empty placeholder so the local build runs. Provision your own hosting configuration before deployment; do not replace the existing live site's configuration with this export.

The existing MIT software license is preserved in `LICENSE`.
