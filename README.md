# Password Generator

Live: https://salahmed-ctrlz.github.io/Sala7-Password-Generator/

Random passwords and passphrases, generated entirely in your browser with the Web Crypto API. Nothing is stored or sent anywhere.

- **Password**: 8–64 characters, choose character types, avoid look-alikes (I l 1 O 0), or supply your own character set.
- **Passphrase**: 3–10 random words with a choice of separator, capitalization and trailing digits.
- Strength is computed from real entropy; the password on screen only changes when you press Generate.

The passphrase wordlist is the [EFF long wordlist](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases) (CC BY 3.0).

## Development

```bash
npm install
npm run dev
npm run deploy   # builds and publishes to gh-pages
```
