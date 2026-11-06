# Homepage rotation

The homepage chooses a random featured recording from the seven existing editorial picks on a fresh page visit. It avoids the previous featured recording when browser storage is available. The feature remains unchanged when navigating within the app, liking a song, or updating playback; there is no timer or autoplay.

The artist row independently chooses seven artists/collaborators with recovered local portraits and at least one linked recording. It avoids the previous row when enough eligible profiles exist. Artist links and recording counts use the catalog. This deliberately uses recovered portraits rather than introducing more remote image requests on initial load.

Artwork, title, artist, play action, provenance link, chain and storage label all follow the selected recording. MIAMI FREESTYLE's specific collaborator credits and measured waveform appear only for that song. Other selections link to their own artist without inventing collaborator credits or waveforms. Back in rotation excludes the featured song.

The selection works without browser storage, but cross-visit repeat avoidance cannot then persist. Unit tests cover stable in-app selection, fresh visits, short pools and unavailable/corrupt storage. Browser checks cover desktop/mobile and light/dark layouts, including long titles.
