# Server-local AI and MCP

The backend can run the existing farming assistant and crop-photo triage through Ollama on the same VPS. The model service is an optional Compose profile, has a project-scoped data volume, and is not started by the normal production Compose command. The MCP HTTP endpoint exposes read-only search/status tools and a question tool; it reads published Knowledge Center content only.

## Server settings

Set these values in the VPS checkout's ignored `backend/.env`. Production Compose loads that file into the API container:

```dotenv
FARMING_AI_PROVIDER=ollama
FARMING_AI_MODEL=qwen3.5:4b
FARMING_EMBEDDING_MODEL=embeddinggemma-2:270m
FARMING_OLLAMA_URL=http://ollama:11434
FARMING_CROP_DOCTOR_ENABLED=false
AGRI_MCP_TOKEN=<long random bearer token>
```

The starter choice is `qwen3.5:4b`: Ollama lists it as a 3.3–4.0 GB text-and-image model. For lower memory use, choose `qwen3.5:2b` instead. `embeddinggemma-2:270m` is the small text embedding model (about 304–378 MB); the server uses it for semantic retrieval. Review free VPS memory before enabling the optional profile; `OLLAMA_MEM_LIMIT` defaults to 6 GB and `OLLAMA_CPUS` to 2 cores. Both can be adjusted to fit the host. These model sizes are download size estimates, not a guarantee of total inference memory. [Qwen3.5 model details](https://ollama.com/library/qwen3.5), [EmbeddingGemma 2 details](https://ollama.com/library/embeddinggemma-2).

For crop-photo triage, keep a vision-capable model selected and set `FARMING_CROP_DOCTOR_ENABLED=true` only after it has been installed. For a CPU-only VPS, response time depends on available memory and CPU.

When server deployment is authorized, the optional model profile can be started with the project's usual Compose environment and project name, for example:

```sh
docker compose --project-name digital-agriculture --env-file <deployment-env> -f docker-compose.prod.yml --profile local-ai up -d ollama
docker compose --project-name digital-agriculture --env-file <deployment-env> -f docker-compose.prod.yml exec ollama ollama pull qwen3.5:4b
docker compose --project-name digital-agriculture --env-file <deployment-env> -f docker-compose.prod.yml exec ollama ollama pull embeddinggemma-2:270m
```

Do not run these commands from a workstation if the requirement is server-local inference. They are documented for later execution on the VPS after its resource use is reviewed and deployment is authorized.

Generate the MCP token on the server with `openssl rand -hex 32`, put it in `backend/.env` as `AGRI_MCP_TOKEN`, and enter the same token into the VS Code prompt when it requests `Digital Agriculture MCP bearer token`. Never commit or paste the token into chat. `/api/mcp` returns `503` until that value is configured and `401` for an invalid token.

The Google Maps browser key is a separate setting: set `VITE_GOOGLE_MAPS_API_KEY` in the deployment environment file used by Compose. Compose passes it only to the frontend image build; local Vite development reads it from `frontend/.env`. The browser key is visible in the built JavaScript, so restrict it to the site's website referrers and the Maps JavaScript API plus Geocoding API. Rebuild the frontend image after changing it.

## MCP tools

The remote endpoint is `https://kaskikotagro.com.np/api/mcp`. It is configured in `.vscode/mcp.json` as an HTTP MCP server. This code adds a read-only crop tool alongside the existing agriculture tools. The deployed endpoint will expose it only after the code and required migrations have been deployed.

- `search_agriculture_knowledge`: searches published articles and learning resources; it uses Ollama embeddings when configured and keyword ranking otherwise.
- `ask_agriculture_assistant`: retrieves relevant published content and asks the configured server model to answer in English or Nepali.
- `triage_crop_problem`: runs text-only crop symptom triage in English or Nepali, retrieves published evidence, returns source metadata, and labels the result preliminary. The website's Crop Doctor uses the same retrieval and safety policy with a vision-capable model and an image.
- `agriculture_ai_status`: reports enabled features without returning credentials or provider URLs.

The web Crop Doctor feedback endpoint stores only a random case identifier, selected crop, and one of three ratings. It does not store the photograph, symptoms, farmer identity, or model response, and it does not train the model. Use feedback as an aggregate quality-review signal only.

RAG vectors are stored in the app's MySQL database by model and content hash, then cached in the backend process for quick reuse. Migration `016_ai_knowledge_vectors.sql` creates the vector table; content changes refresh their vectors and unpublished/deleted items are pruned from the active model index. Draft articles and private records are never searched. Existing browser voice input, speech output, crop photo triage, and human audio/video calls remain in their current features.
