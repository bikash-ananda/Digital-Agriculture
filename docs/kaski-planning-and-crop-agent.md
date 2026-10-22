# Kaski planning engine and crop assistance agent

## Purpose

This project should make the farmer registry useful for local planning without treating its current records as a representative census. Kaski is administered through Pokhara Metropolitan City and four rural municipalities (Annapurna, Machhapuchchhre, Madi, and Rupa), with decisions and service delivery often needing ward-level detail. The data model therefore keeps the local-level and ward on farmer and farm records, and puts district-wide historical baselines in a separate, cited table.

## Evidence and geographic context

- The National Statistics Office (NSO) Kaski district profile and Statistics Coordination Office are the primary sources for district geography and official demographic tables: [Kaski district profile, 2080](https://scokaski.nsonepal.gov.np/content/8/district-objective-description-kaski-2080/) and [NSO Kaski profile page](https://www.nsonepal.gov.np/content/7738/7738-district-profile-kaski/).
- The Statistics Coordination Office lists 600,051 residents, 160,651 households, population density of 298 per km², and intercensal annual population growth of 1.90% from the 2021 census. These are historical, district-level baselines, not current estimates: [Kaski key indicators, Census 2021](https://sokaski.nsonepal.gov.np/content/2724/2724-key-indicators/).
- The National Sample Census of Agriculture 2021/22 reports 53,228 agricultural holdings in Kaski. Preserve the source period and do not present the app's farmer count divided by this figure as a coverage rate: [Agriculture Census district summary](https://www.agricensusnepal.gov.np/upload_file/files/post/1731650149_1221316497_Agriculture%20Census%202021_District%20Summary%20Report_by%20Province.pdf).
- NSO's microdata catalog describes census data and sample microdata. A sample extract is not a substitute for district totals or ward estimates; use published summary tables unless NSO approves the microdata use and its sampling design supports the desired estimates: [Population census microdata catalog](https://microdata.nsonepal.gov.np/index.php/catalog/124), [Agriculture census microdata catalog](https://microdata.nsonepal.gov.np/index.php/catalog/134).
- Agriculture programs are geographically targeted by crop, commodity, municipality, and ward. PMAMP Kaski documents vegetable, cardamom, and dairy zones in selected wards; those changing program boundaries should be versioned as program facts, not hard-coded as permanent ecological boundaries: [PMAMP Kaski program areas](https://www.piukaski.pmamp.gov.np/introduction).
- NARC has research offices in Kaski at Lumle, Malepatan, and Begnas. Their publications should be preferred when building crop-specific local retrieval material: [NARC office network](https://narc.gov.np/about-us/maps).
- NSO's agriculture census questionnaire provides a useful field checklist for holdings, parcels, land use, irrigation, workers, crops, livestock, losses, and gender-disaggregated roles: [Agriculture census questions](https://agricensusnepal.gov.np/question). The app should not import individual microdata unless licensing, consent, and the NSO methodology permit it.
- Local-level names and boundaries should come from NSO/official local-government records; the [District Coordination Committee Kaski](https://dcckaski.gov.np/lg-contact) lists the local governments.

## Data collected for planning

The survey and farm record should collect only information that can be explained and used:

1. **People and service reach:** selectable farmer category, occupation and education, household size, agricultural workers, local level, ward, verification, and explicit data-use consent.
2. **Farm location and access:** GPS coordinates only after a user action, GPS accuracy, location source, map-derived address for the farm, local level and ward confirmation, altitude if known, and road access. A map lookup is a suggestion that the user must verify; it is not proof of a boundary.
3. **Farm environment:** farm area, irrigated area, irrigation type, soil, water source, land use, terrace farming, and distance to market when the farmer can estimate it. Unknown values remain blank instead of being guessed.
4. **Production and livelihoods:** crop, season, variety where known, system, area, harvest/production, reported losses and causes; livestock, production, and agricultural inputs can be added in the separate Data Center forms.
5. **Risk observations:** drought, flood, hail, landslide, erosion, frost, storm, pest, or disease are recorded as reported observations with a period and place. The planning engine must not turn a farmer report into a forecast or a hazard map.

Population and agriculture census totals are stored in `district_planning_baselines` with their reference period, units, source URL, and methodology note. The Planning tab compares those historical baselines with current in-system records, makes the denominator visible, and prompts staff to review missing or inconsistent data. It does not estimate district coverage or rank municipalities by agricultural need.

## Crop agent workflow

The crop agent follows an evidence-backed, bounded workflow inspired by REA's MCP interaction model:

1. Intake farmer-selected crop and reported symptoms; the web Crop Doctor may also receive one image.
2. Retrieve only published Knowledge Center articles/resources, using local Ollama embeddings when configured and falling back to keyword search.
3. Provide the vision/text model with the case and retrieved excerpts, with instructions to distinguish observation, possible causes, safe checks, and unknowns.
4. Return source titles and links with the response. A missing source must be shown as missing; the model cannot claim a local confirmed recommendation.
5. Collect a one-click usefulness / expert-needed signal for quality review. Feedback is not model training; any future learning set needs a separate expert review, consent, dataset policy, and evaluation.
6. Escalate severe, spreading, or uncertain symptoms to a qualified agriculture technician. Do not issue pesticide brand, dosage, or spray schedules.

The MCP endpoint provides `triage_crop_problem` for text-only crop cases plus source search and AI status. It is bearer-token protected and uses the same service as the website. The endpoint is an integration surface for connected agents; the public website never receives the MCP token.

REA itself is a local developer reverse-engineering MCP for tracing software and runtime evidence, not an agriculture diagnosis model. The project borrows the inspect → cite evidence → explain limits → implement/review loop; it does not copy REA source code or install REA into the production server. See [morluto/rea](https://github.com/morluto/rea).

## What this first version does not claim

- No model is trained on Kaski crop photos, and user feedback does not automatically update weights.
- An image result is preliminary triage, not an expert diagnosis.
- The project does not infer climate, landslide, flood, soil fertility, crop suitability, yields, market prices, or future population from incomplete farmer records.
- No authoritative ward-boundary polygons or environmental hazard layers are currently imported. Farm coordinates are point records for the consenting farmer's farm; they are not hazard, land-ownership, or district-risk maps.
- Google reverse geocoding can suggest a formatted address but does not establish cadastral ownership, administrative ward, or legal boundary. Confirm map-derived local level and ward with the farmer.

## Activation notes

Apply migrations 016–018 before enabling persistent RAG vectors, planning views, or crop-feedback storage. Google Maps requires `VITE_GOOGLE_MAPS_API_KEY`, with the Maps JavaScript and Geocoding APIs enabled and browser-key restrictions configured. The server AI provider and model remain in `backend/.env`; the MCP endpoint remains unavailable unless `AGRI_MCP_TOKEN` is configured. Never expose that token or a model key to the frontend.
