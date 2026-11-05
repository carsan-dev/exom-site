# EXOM public site

Public site prepared locally for `https://www.exommethod.com` (the apex domain redirects to www).

The approved V4 sources remain in `REDESIGN/prototype-v4/`. A dependency-free Node.js 24 build produces the public-only `dist/` directory. Existing root HTML and earlier prototypes are preserved, but are not part of the new static output.

```text
npm run build
npm test
npm run preview
```

No dependency installation is needed. Preview serves `http://127.0.0.1:4177/` with real email unconditionally disabled. Automated mail tests use an isolated mock, never account credentials.

Routes:

- `/`
- `/app/`
- `/historia/`
- `/privacy/`
- `/support/`
- `/eliminar-datos/`
- `/aviso-legal/`

Deployment configuration: Vercel project `exom-site`, repository root, Node.js 24, `vercel.json` build command and `dist` output. `api/solicitudes.mjs` is the protected server entry, separate from static files.

**Production release authorized on 5 November 2026.** The owner approved the final protected Preview, publication through `main`, form activation and one controlled submission with fictional data. The App video and spacing are approved. The branded email was received and approved in Gmail through an isolated test; never promote that test deployment or its temporary adapter. Preview test variables have been removed and the owner confirmed revoking the test key. Production configuration, access protection and the shared limit of five submission attempts per IP per ten minutes have been checked. Pushing to production `main` triggers Vercel. Activation requires both gates and the existing production secrets; never commit their values. Deployment completion and the production delivery check must be verified after the push, not inferred from this authorization.

The repository includes regression fixtures used by the tests; they are not public assets. Historical raw media and working files not required by the build or tests remain local. Only `dist/` is published as static content.

See [release preparation and remaining checks](REDESIGN/prototype-v4/release.README.md) and [form operation and deferred items](REDESIGN/prototype-v4/form-launch.README.md). Do not edit generated files in `dist/`; the build refuses to overwrite manual or unowned files.
