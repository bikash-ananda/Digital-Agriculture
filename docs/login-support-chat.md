# Login page support chat

The login page includes an anonymous floating chat panel. Visitors do not need an account and do not leave the site. The backend stores each message, sends a WhatsApp notification to the configured developer phone, and adds the developer's WhatsApp reply to the visitor's browser chat using short polling.

## Required setup

1. Apply the new database migration with `npm run db:migrate` from `backend`.
2. Configure a WhatsApp-enabled Twilio sender in the protected backend environment: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_WHATSAPP_FROM`. Set `SUPER_ADMIN_PHONE` to the developer's E.164 phone number, or set `SUPPORT_WHATSAPP_ADMIN` if the deployment passes that optional variable to the API container.
3. Create and obtain approval for a WhatsApp Content Template with two variables: the conversation code and the visitor's message. A suitable template is: `New website chat #{{1}}: {{2}}. Reply to this message or send #{{1}} followed by your reply.` Set its SID as `TWILIO_WHATSAPP_CONTENT_SID` (or `TWILIO_SUPPORT_CONTENT_SID` if the deployment passes that optional variable to the API container).
4. Deploy the API behind a public HTTPS URL and set `PUBLIC_BASE_URL` to the public origin. The inbound URL is derived as `https://your-domain/api/support-chat/whatsapp/inbound`; configure that exact URL as the inbound-message webhook on the Twilio WhatsApp sender. `TWILIO_SUPPORT_WEBHOOK_URL` can override it when the deployment passes that optional variable to the API container.
5. Restart the backend. WhatsApp webhooks are verified with Twilio's `X-Twilio-Signature` using `TWILIO_AUTH_TOKEN`; the URL used for verification must exactly match the public webhook URL.

The developer can reply directly to a notification in WhatsApp. If replying without quoting the notification, prefix the reply with the ticket code, for example `#A1B2C3D4E5 We are checking this for you.` The chat widget polls for the reply and displays it on the login page. Visitors should keep the login tab open while waiting.

## Smart Farming chat calls

Smart Farming chat sends messages and file data directly between the two browsers with a WebRTC data channel. Message bodies and file contents are kept in each user's browser IndexedDB; the API holds only short-lived online session and call-signaling state in memory. Each user needs to be online at the same time, and stored chats do not sync to another browser or device. Files are limited to 100 MB.

Voice and video calls use browser camera/microphone permissions. Google STUN is the default. For reliable calls through restrictive routers and carrier-grade NAT, configure a coturn service with a shared secret and pass `TURN_URLS` (comma-separated `turn:`/`turns:` URLs), `TURN_SHARED_SECRET`, and optionally `TURN_CREDENTIAL_TTL_SECONDS` to the API container. The current production compose file does not forward these optional TURN variables, so the deployment team must add them to its protected environment wiring before expecting calls to work on those networks. TURN relays encrypted media/data but consumes relay bandwidth.

WhatsApp requires approved templates to start business-initiated conversations outside its 24-hour customer-service window. The template is required for the relay to be reported as ready. The website's messages remain in the database if Twilio is not configured or a notification cannot be delivered.

Old conversations are automatically removed after 90 days without a new message.

## Local development

Copy `backend/.env.example` to the ignored `backend/.env` and fill in local database and optional Twilio settings. Never commit `.env` or place provider credentials in frontend files. The chat panel can render without Twilio; messages are stored and shown on the website when MySQL and migration `011_support_chat.sql` are available.
