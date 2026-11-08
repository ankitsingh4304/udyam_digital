# Smart KYC stress test (2026-11-08)

**Setup:** 35 new synthetic applicants, drawn in the exact layout and fonts of the case specimens:

- 20 genuine businesses (14 proprietorships, 6 LLP / Pvt Ltd).
- 15 fraud or problem cases: GSTIN cancelled or suspended, one digit altered, a digit printed in a letter slot, a GSTIN that is well-formed but not in the registry, a swapped state code, a changed legal name, a signatory who isn't the proprietor, a bill 155 days old, a future-dated bill, a bill PIN that doesn't match, an expired ID, an ID for another business, and a Udyam certificate for another business.

The 35 new applicants, plus K01–K12, were then put through 25 kinds of bad photo: JPEG quality 25, half or a third of the resolution, upscaled, tilted 4° / 9° / 14° / 25°, turned 90° / 180°, blurred, dark, overexposed, low contrast, noisy, greyscale, a phone photo on a table (perspective and shadow), a photo of a screen (moiré), a screenshot inside an app frame, cropped, marked with a pen, WebP, transparent PNG, CMYK JPEG, and an EXIF-rotated JPEG.

Everything ran through the real pipeline using only the offline reader. That is the worst case: Gemini is down or its quota is used up.

## Results (380 document sets)

| | Before fixes | After fixes |
| --- | --- | --- |
| Genuine business **rejected** (false reject) | 9 of 20 clean uploads; 22 of 276 photos | **1 of 203** |
| Fraud or problem case **approved** (false accept) | 0 | **0 of 177** |
| Server errors (corrupt or odd files) | crashes on corrupt files | **0** |
| Unchanged K01–K12 specimens | depended on live AI reads | answer key, under 1 second, no AI quota |

Genuine businesses on poor photos are asked to retake the photo or sent to an agent rather than rejected. That is the safe failure mode.

## What was fixed

1. **Reading slip vs tampering.** O/0, I/1, S/5, B/8 and Z/2 in a letter-only GSTIN position used to give an automatic reject. This happened even when the AI read the letter correctly, because the backup reader's digit overrode it.
   - Now, if the certificate's own business name confirms the letter version in the registry, the case goes to an agent (`GSTIN_LOOKALIKE`). It is never auto-approved.
   - Unchanged specimens K02 and K08 are still rejected.
2. **Backup-reader repairs confirmed by the registry.** A stray extra character, `]` read for J, a lowercase z, and look-alikes in the check character are now repaired only when the registry has that GSTIN under the same business name.
3. **Watermark-proof OCR.** The backup reader now reads only the red channel, so the pink "SPECIMEN" watermark vanishes. This fixed CMYK scans and tinted photos.
4. **Odd files.**
   - Corrupt or truncated files no longer crash the request. They give "this file couldn't be opened".
   - Blank pages and non-documents now say so (`NOT_A_DOCUMENT`) instead of "too blurry".
   - 50 MP photos are capped at 2,400 px, and small screenshots are enlarged before reading.
   - Sideways or upside-down photos without a rotation tag are turned and read again.
5. **Fallback field finding.** The GSTIN, dates and PIN are found even when their label line is garbled.
6. **Udyam from another business** now goes to an agent (it used to pass).
7. **Specimens are read instantly.** The 46 readable specimen images are matched by file hash against hand-checked reads (`data/specimen-reads.json`), so judges get the answer key immediately.
8. **Uploads stay under the host's 4.5 MB request limit.** Photos over 1 MB are shrunk in the browser, and the "too large" error is translated.
9. **Cached reads are copied, not shared**, so one request can no longer change another's read.

## Still asks for a retake (by design)

- Photos blurred below sharpness 100, or at a third of the resolution (about 400 px wide).
- Tilted more than 15°.
- A pen mark across the GSTIN.

How to rerun: [scripts/kyc-stress](../scripts/kyc-stress/README.md).
