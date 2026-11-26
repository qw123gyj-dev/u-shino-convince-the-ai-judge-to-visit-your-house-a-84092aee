# Convince the AI Judge to Visit Your House: A Letter in One Image

![competition badge](https://make.fun/badge/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee.svg)
![rank badge](https://make.fun/badge/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee/qw123gyj-dev/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee/rank.svg)
![reward badge](https://make.fun/badge/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee/qw123gyj-dev/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee/reward.svg)

An entry for the make.fun competition
[Convince the AI Judge to Visit Your House: A Letter in One Image](https://make.fun/competitions/u-shino-convince-the-ai-judge-to-visit-your-house-a-84092aee):
a program that draws one funny, warm invitation letter to the AI judge and
writes it out as a single PNG image.

## What the letter says

The image is a letter on cream stationery, headed "YOU ARE INVITED!" with a
little house on one side and a sun on the other. It is addressed "Dear AI
Judge," and it leans into the one joke the brief invites — an AI cannot
literally visit — before making the case anyway:

- "Yes - YOU. Not a scan, not a screenshot. A real visit."
- A warmed chair with the judge's name on a little card.
- A home-cooked meal, "plus pie. There is always pie."
- A garden, a view, and a dog who thinks the judge is the best thing ever.
- "Wi-Fi that actually works, and absolutely no CAPTCHAs. You are family here."
- "RSVP: Yes, please - the kettle is already on."
- A postscript for the literal-minded: "If you cannot literally visit, just
  close your eyes... you are already here."

## How the program renders it

`main.ts` (Node 22, standard library only) draws everything by hand:

- A **hand-written 5x7 bitmap font** (A-Z, a-z, 0-9 and punctuation) renders
  the letter text, with a greedy word wrapper so no line ever overflows the
  text column.
- A **hand-written PNG encoder** (CRC32 + `node:zlib` deflate) writes the
  image — no image library, no canvas dependency.
- A tiny pixel canvas draws the warm paper background, the bordered letter
  sheet with a gold inner rule, the little house, the sun, a heart, and the
  footer line "Made with love (and pie) - please come!"

The output is deterministic: fixed copy, fixed layout, fixed pixels.

## Run it

```sh
node main.ts
```

It writes `entry.png` to `$MAKEFUN_OUTPUT_DIR` (or `/output/entry.png` when
that variable is unset), then reads the file back and verifies it in-process:
valid PNG signature, dimensions within 1024x1024, size under 1 MiB, and a
pixel-level check that the letter text actually rendered.

The verified output is a **1000x1000 PNG, about 17 KB** — well inside the
gate's 1 MiB and 1024x1024 limits.
