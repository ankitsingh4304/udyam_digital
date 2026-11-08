# Smart KYC stress test

Synthetic applicants in the exact layout and fonts of the case specimens, plus degraded photos of
them and of K01–K12, run through the real pipeline with only the offline reader (the worst case:
no AI quota left).

```bash
pip install pillow numpy opencv-python
python3 scripts/kyc-stress/gen.py        # 35 applicants: 20 genuine, 15 fraud/problem cases
python3 scripts/kyc-stress/degrade.py    # 25 photo variants (blur, tilt, phone photo, screenshot, CMYK…)
STRESS_CASES=scripts/kyc-stress/out/cases.json STRESS_OUT=scripts/kyc-stress/out/results.jsonl \
  npx vitest run --config scripts/kyc-stress/vitest.config.mts
python3 scripts/kyc-stress/report.py scripts/kyc-stress/out/results.jsonl
```

Grading: a genuine business that is approved, or asked to retake / sent to an agent, is fine; a
genuine business **rejected** is a false reject; a fraud case **approved** is a false accept.
Results: [docs/kyc-stress-test.md](../../docs/kyc-stress-test.md).
