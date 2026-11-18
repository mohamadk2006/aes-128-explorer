# AES-128 Explorer

EECE 455 – Project 7 ("AES Again"): an interactive, browser-based platform for learning AES-128.
Built with React + TypeScript + Vite. All cryptography runs in the browser; there is no backend.

## Requirements (from the project list)

1. **Rounds** – given a 128-bit key and one data block, show one AES round step by step, pausing after
   each operation; then run a full encryption or decryption showing the key and data after each round.
2. **Avalanche** – store the data after each round, then encrypt again with a new data block (same key)
   or a new key (same block) and show the number of mismatched bits after each round.
3. **Key expansion** – from a 128-bit key, generate the 44 words for the 10 rounds and display each group
   of 4 words together.

## Run it

```bash
npm install
npm run dev     # local development server
npm test        # unit tests (Vitest)
npm run lint    # oxlint
npm run build   # static site in dist/
```

## Code layout

| Path | What | Owner |
| --- | --- | --- |
| `src/aes/types.ts` | Shared types (`Word`, `Block`, `Mode`) | Team – change only after agreeing |
| `src/aes/hex.ts` | Hex parsing and formatting | Team |
| `src/aes/keyExpansion.ts` | S-box, Rcon, RotWord, SubWord, `expandKey` | Part 3 |
| `src/aes/cipher.ts` | Round operations, `encryptTrace` (state after every step/round), `encrypt` | Encryption |
| `src/parts/rounds/` | Part 1 page | Part 1 |
| `src/parts/avalanche/` | Part 2 page | Part 2 |
| `src/parts/key-expansion/` | Part 3 page | Part 3 |
| `src/App.tsx` | Navigation between the parts | Team |

### The key expansion contract

`src/aes/keyExpansion.ts` defines what the other parts can rely on:

- `expandKey(key: Block): KeySchedule` → `words` (w0 … w43), `roundKeys` (K0 … K10 as 16-byte blocks)
  and `steps` (how each word was derived, for the display).
- `SBOX`, `INV_SBOX` – the AES S-box and its inverse (Part 1 uses them for SubBytes / InvSubBytes).
- `RC`, `rotWord`, `subWord`.

### The encryption contract

`src/aes/cipher.ts` is used by Part 1 and Part 2:

- `encryptTrace(plaintext, key)` → `rounds[0 … 10]`, each with `roundKey`, `input`, `steps`
  (the state after SubBytes / ShiftRows / MixColumns / AddRoundKey) and `state` (end of round),
  plus the final `ciphertext`.
- `subBytes`, `shiftRows`, `mixColumns`, `addRoundKey`, `encrypt`.

Part 2 compares `rounds[r].state` of two traces to count the differing bits after each round.

## Working together

1. Never push directly to `main`. Create a branch for your part: `git switch -c <part-name>`.
2. Commit often, then push: `git push -u origin <part-name>`.
3. Open a pull request into `main` on GitHub; another team member reviews it before merging.
4. Before opening a PR, run `npm test`, `npm run lint` and `npm run build`.
5. Pull `main` into your branch regularly (`git pull origin main`) to pick up the others' work.

Reference material: chapter 5 slides (AES) and FIPS-197 (test vectors in Appendix A–C).
