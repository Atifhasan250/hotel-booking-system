# ImageKit media contract

- Researched: 2026-08-27 Asia/Dhaka.
- Scope: M2 catalog media; revalidate when the ImageKit upload API or SDK version changes.
- Primary sources: ImageKit Upload File API V1/V2 and official JavaScript/Next.js integration documentation at
  `https://imagekit.io/docs/api-reference/upload-file/upload-file`,
  `https://imagekit.io/docs/integration/javascript`, and `https://imagekit.io/docs/integration/nextjs`.

## Durable conclusions

- The private API key is server-only. Browser uploads receive short-lived authorization from an authenticated,
  authorized server endpoint.
- Upload API V2 uses a JWT signed with HS256, identifies the public key in `kid`, and verifies the complete upload
  payload. Book My Room uses it so a credential is bound to the expected property folder and file name.
- Upload checks support actual file size and MIME validation. M2 permits JPEG, PNG, and WebP images up to 10 MiB and
  includes those checks in the signed payload.
- The upload response is not catalog truth by itself. A separate authorized registration mutation validates the
  expected ImageKit delivery origin/folder, provider file ID/path, dimensions, format, alt text, ownership, order,
  and moderation state before storing a media asset.
- File deletion/replacement is not exposed in M2. Catalog media is archived through an audited application use case;
  future provider-side cleanup needs its own retry/audit workflow.

## Controlled limitations

- Image rights and production content approval remain owner/operations decisions. Signing proves request integrity,
  not copyright ownership or editorial approval.
- Live provider success is not claimed without configured non-placeholder credentials and an ImageKit contract test.
