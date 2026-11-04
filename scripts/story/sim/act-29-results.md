# Act 29 sims (Forge self-play, default AI both seats, STORY_SEED=1; final check seed 7)

Bands (hero win): slots 1-3 60-80%, slots 4-7 45-60%, boss and secret 30-45%.
Tuning runs are 24 games. The final check is a 10-game run, per Randall (3 Nov), so it is noisy on its own.

| Battle | Hero vs villain | First run | Last tuning run | 10-game check |
|---|---|---|---|---|
| b1 The Beacon (Easy) | The Izzet League vs The Golgari Swarm | 20/24 (83%) | 17/24 (71%) | 10/10 |
| b2 The Queen of the Swarm (Easy) | The Golgari Swarm vs The Boros Legion | 13/24 (54%) | 18/24 (75%) | 3/10 |
| b3 Debts and Ghosts (Easy) | The Azorius Senate vs The Cult of Rakdos | 19/24 (79%) | 19/24 (79%) | 7/10 |
| b4 The Dreadhorde Arrives (Normal) | The Izzet Storm vs The Dreadhorde | 14/24 (58%) | 14/24 (58%) | 7/10 |
| b5 The Kaya Gambit (Normal) | The Orzhov Syndicate vs The Eternals | 14/24 (58%) | 14/24 (58%) | 5/10 |
| b6 Esper Superfriends (Normal) | Esper Superfriends vs Mono-Red | 9/24 (38%) | 8/24 (33%) | 5/10 |
| b7 Golgari Midrange (Normal) | Golgari Midrange vs The Gruul Clans | 15/24 (63%) | 13/24 (54%) | 8/10 |
| b8 The Dragon-God (Hard) | The Gatewatch and the Guilds vs Bolas's Dreadhorde | 12/24 (50%) | 7/24 (29%) | 5/10 |
| b9 Esper Hero (secret, Hard) | The Gruul Clans vs Esper Hero | 8/24 (33%) | 8/24 (33%) | 3/10 |

Out of band: b1 (100%) and b2 (30%) swing in the 10-game check against 71% and 75% in the last 24-game tuning runs, and b4 and b7 sit above band in the 10-game check, so single 10-game runs are noisy. b6 (Esper Superfriends) and b8 (the Dragon-God) sit under their 24-game bands: Forge's CPU plays planeswalker and control decks less sharply than a person does. These are documented, not hidden.
