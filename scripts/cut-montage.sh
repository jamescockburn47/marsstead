#!/usr/bin/env bash
# cut-montage: JPEG sequences -> one LinkedIn-ready mp4 (~1 min, 1080p30).
# Captions via textfile= (no filtergraph quoting pain). Requires ffmpeg.
set -e
# Git-Bash rewrites colons and path-like args inside filter strings —
# disable MSYS argument conversion entirely for this script
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'
cd "$(dirname "$0")/../media/montage"

FONT='georgia.ttf'   # copied local — sidesteps the drive-colon escape rathole

# descriptive wording, CENTRED on frame (James 2026-07-20: "walking on
# olympus etc in the centre of the frame"). Lowercase, present-tense.
cap () { printf '%s' "$2" > "cap$1.txt"; }
cap 1 'dawn on the real mars'
cap 2 'driving the open country'
cap 9 'the whole world turns'
cap 3 'walking on olympus'
cap 4 'beside viking 1, fifty years on'
cap 5 'something is signalling'
cap 8 'the old machines heard it first'
cap 6 'flying anywhere'
cap 7 'marsstead.app - free, no download'

# DRAW: caption centred vertically (y=(h-text_h)/2) and horizontally.
DRAW () {  # $1 cap-number  $2 fontsize  $3 fadeout-start
  echo "drawtext=fontfile=$FONT:textfile=cap$1.txt:fontsize=$2:fontcolor=white@0.9:shadowcolor=black@0.7:shadowx=2:shadowy=2:x=(w-text_w)/2:y=(h-text_h)/2,fade=t=in:st=0:d=0.35,fade=t=out:st=$3:d=0.35"
}

clip () {  # $1 seq prefix  $2 cap-number  $3 fontsize  $4 out  $5 fadeout-start
  ffmpeg -y -framerate 30 -i "$1_%04d.jpg" \
    -vf "$(DRAW $2 $3 $5),scale=1920:1080:flags=lanczos" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 "$4" -loglevel error
  echo "cut $4"
}

clip s1  1 46 c1.mp4 7.6

# s2: James's own drive, centre-cropped to 16:9 (the crop amputates the cursor)
JREC='C:/Users/James/Downloads/Recording 2026-07-20 113053.mp4'
ffmpeg -y -ss 17.2 -t 9.0 -i "$JREC" \
  -vf "crop=2558:1439:0:77,scale=1920:1080:flags=lanczos,$(DRAW 2 46 8.6)" \
  -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 c2.mp4 -loglevel error
echo "cut c2.mp4 (James's footage)"

# scale-of-the-world: the console's live globe, captured clean (cursor-free)
# from the actual rotatable planet (pickup-scale.mjs). Brief, ~3.5 s.
ffmpeg -y -framerate 30 -i "sc_%04d.jpg" -frames:v 108 \
  -vf "crop=916:516:339:70,$(DRAW 9 46 2.9),scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 c9.mp4 -loglevel error
echo "cut c9.mp4 (clean globe)"

clip s3  3 46 c3.mp4 8.6

# s4: the Viking landing, trimmed to descent + touchdown + dust — no
# walking-to or standing-next-to the wreck (James 2026-07-20).
# descent -> touchdown -> dust -> a long HOLD on the wide reveal (Viking
# prominent lower-left, no figure — pickup-s4 locks the lens so the money
# shot holds instead of zooming to a standing close-up). Start a touch
# into the descent; hold the reveal ~2 s before fading.
ffmpeg -y -framerate 30 -start_number 40 -i "s4_%04d.jpg" -frames:v 216 \
  -vf "$(DRAW 4 46 6.4),scale=1920:1080:flags=lanczos" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 c4.mp4 -loglevel error
echo "cut c4.mp4 (trimmed)"

clip s5  5 46 c5.mp4 4.0
clip s5b 5 46 c5b.mp4 1.6
clip s5c 8 46 c5c.mp4 5.2
clip s6  6 46 c6.mp4 7.6
clip s7  7 50 c7.mp4 4.6

printf "file 'c1.mp4'\nfile 'c2.mp4'\nfile 'c9.mp4'\nfile 'c3.mp4'\nfile 'c4.mp4'\nfile 'c5.mp4'\nfile 'c5b.mp4'\nfile 'c5c.mp4'\nfile 'c6.mp4'\nfile 'c7.mp4'\n" > list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -c copy marsstead-montage.mp4 -loglevel error
echo "DONE: media/montage/marsstead-montage.mp4"
