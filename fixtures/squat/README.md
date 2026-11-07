# Squat QA fixtures

Five real phone recordings from *A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels*, version 3. Credit Duddela Sai Prashanth, Priya Kamath, Rakshith Bhandary, S Ashlesh Pai, Pratham PN, Advith P, and Abhishek Mashetty. [Dataset and DOI](https://doi.org/10.17632/kgbb3yn47p.3) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

These derivatives are trimmed from the start, scaled to 540×960, encoded as H.264 at the source 15 fps, and muted. The dataset's exercise-quality labels are source metadata. MoveIDE uses these clips to check tracking, rep boundaries, and evidence navigation.

- `sample-squat.mp4` · subject 001, side. Short two-rep workbench sample and Seldon baseline input. [Manual fixture labels](sample-squat.labels.json)
- `side-gym.mp4` · subject 004, side. Clearer lighting and a different lifter.
- `side-mirror.mp4` · subject 008, side. Reflections and busy framing.
- `side-busy-background.mp4` · subject 016, side. Moving people in the background.
- `front-view-challenge.mp4` · subject 001, front. Challenge input for the side-view protocol and an example of capture guidance.

The first, repeatable sample contains bodyweight squats. These clips are fixtures for the prototype, with no lab reference angles. Surface a confidence warning or unavailable result when the required side landmarks are unreliable.
