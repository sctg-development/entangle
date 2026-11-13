# Embedded wordlist sources

The files in `data/` are embedded in the binary (no external files needed).

| File | Language | Source | License |
|------|----------|--------|---------|
| en.txt | English | EFF large wordlist, 2016, Electronic Frontier Foundation | CC-BY-3.0 |
| fr.txt | French | Tango, for Tails/Tor Project (diceware `wordlist_fr`), 2024 | CC0-1.0 |
| de.txt | German | Uli Fouquet (diceware `wordlist_de`), 2021 | CC-BY-3.0 |
| es.txt | Spanish | victordargallo (diceware `wordlist_es`), 2024 | CC-BY-4.0 |
| it.txt | Italian | victordargallo (diceware `wordlist_it`), 2024 | CC-BY-4.0 |
| pt.txt | Portuguese (pt-br) | drebs (diceware `wordlist_pt-br`), 2019 | CC-BY-3.0 |

Spanish and Italian lists have 8192 words, French 7775, the others 7776. The French list
had a duplicate capitalised entry ("Internet"), removed (7775 words). Wordlists come from
https://github.com/ulif/diceware (French originally from Tails task 20014).
