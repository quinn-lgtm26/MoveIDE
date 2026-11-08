# Squat QA fixtures

Seven real phone recordings from *A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels*, version 3. Credit Duddela Sai Prashanth, Priya Kamath, Rakshith Bhandary, S Ashlesh Pai, Pratham PN, Advith P, and Abhishek Mashetty. [Dataset and DOI](https://doi.org/10.17632/kgbb3yn47p.3) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

These clips are trimmed, encoded as muted H.264 at the source 15 fps, and preserve the source anonymization. Most were scaled to 540×960. The dataset's exercise-quality labels are source metadata. MoveIDE uses these clips to check tracking, rep boundaries, and evidence navigation.

- `sample-squat.mp4` · subject 001, side. Original two-rep sample kept as a hard tracking fixture. Source anonymization and other people obscure the lifter. [Manual fixture labels](sample-squat.labels.json)
- `side-gym.mp4` · subject 004, side. Clearer lighting and a different lifter.
- `supported-squat.mp4` · the earlier Seldon smoke sample, a six-second trim from `side-gym.mp4` covering its two complete middle reps. It includes source frames 24 through 113, zero-based at 15 fps. The trim excludes a partial squat at each end and preserves the original anonymization. Its bottom frames were labeled by visual review of the source before comparing model output, using the same 150 ms tolerance as the original sample. [Manual fixture labels](supported-squat.labels.json)
- `clear-squat.mp4` · subject 010, side. The workbench demo sample, a two-rep 3.8-second trim at the original 810×1440 with better lighting and clearer lower-body landmarks. From `Dataset Exercise-wise/squat/good/side/subject_010_squat_good_side.mp4`, source frames 26 through 82 inclusive, zero-based at 15 fps. Its bottom frames were labeled visually before pose inference. [Manual fixture labels](clear-squat.labels.json)
- `bad-form-squat.mp4` · subject 010, side. The bad-form half of the Compare examples pair: the same lifter, gym and camera as `clear-squat.mp4`, from `Dataset Exercise-wise/squat/bad/side/subject_010_squat_bad_side.mp4`. Two complete reps, source frames 3 through 68 inclusive, zero-based at 15 fps, at the original 810×1440. The visible fault is a much stronger forward torso lean. The good/bad labels are the dataset's, not MoveIDE's. Its bottom frames were labeled visually before pose inference. [Manual fixture labels](bad-form-squat.labels.json)
- `side-mirror.mp4` · subject 008, side. Reflections and busy framing.
- `side-busy-background.mp4` · subject 016, side. Moving people in the background.
- `sample-squat-bottom-1067ms.jpg` · still of the first labeled bottom in `sample-squat.mp4`. The permitted source image for the BE-3 ChatGPT test request.
- `front-view-challenge.mp4` · subject 001, front. Challenge input for the side-view protocol and an example of capture guidance.

The labeled clips contain bodyweight squats and provide timing references for the prototype. Surface a confidence warning or unavailable result when the required side landmarks are unreliable.
