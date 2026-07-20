#!/usr/bin/env bash
# cut-montage: JPEG sequences -> one LinkedIn-ready mp4 (~55 s, 1080p30).
# Captions via textfile= (no filtergraph quoting pain). Requires ffmpeg.
set -e
# Git-Bash rewrites colons and path-like args inside filter strings —
# disable MSYS argument conversion entirely for this script
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'
cd "$(dirname "$0")/../media/montage"

FONT='georgia.ttf'   # copied local — sidesteps the drive-colon escape rathole

cap () { printf '%s' "$2" > "cap$1.txt"; }
cap 1 'MARS. REAL TERRAIN - IN YOUR BROWSER'
cap 2 'THE OPEN COUNTRY, BY ROVER'
cap 3 'THE WHOLE SKY, FROM THE SUMMIT OF OLYMPUS'
cap 4 'LAND BESIDE VIKING 1 - 50 YEARS ON'
cap 5 'SOMETHING IS SIGNALLING'
cap 8 'THE OLD MACHINES HEARD IT FIRST'
cap 6 'FLY ANYWHERE'
cap 7 'MARSSTEAD.APP - FREE, NO DOWNLOAD'

clip () {  # $1 seq prefix  $2 cap-number  $3 fontsize  $4 out  $5 fadeout-start
  ffmpeg -y -framerate 30 -i "$1_%04d.jpg" \
    -vf "drawtext=fontfile=$FONT:textfile=cap$2.txt:fontsize=$3:fontcolor=white@0.88:shadowcolor=black@0.65:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-80,fade=t=in:st=0:d=0.35,fade=t=out:st=$5:d=0.35,scale=1920:1080:flags=lanczos" \
    -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 "$4" -loglevel error
  echo "cut $4"
}

clip s1  1 44 c1.mp4 7.6
# s2: James's own drive, centre-cropped to 16:9 (the crop amputates the cursor)
JREC='C:/Users/James/Downloads/Recording 2026-07-20 113053.mp4'
ffmpeg -y -ss 17.2 -t 9.0 -i "$JREC"   -vf "crop=2558:1439:0:77,scale=1920:1080:flags=lanczos,drawtext=fontfile=$FONT:textfile=cap2.txt:fontsize=44:fontcolor=white@0.88:shadowcolor=black@0.65:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-80,fade=t=in:st=0:d=0.35,fade=t=out:st=8.6:d=0.35"   -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r 30 c2.mp4 -loglevel error
echo "cut c2.mp4 (James's footage)" 
clip s3  3 44 c3.mp4 8.6
clip s4  4 44 c4.mp4 13.6
clip s5  5 44 c5.mp4 4.0
clip s5b 5 44 c5b.mp4 1.6
clip s5c 8 44 c5c.mp4 5.2
clip s6  6 44 c6.mp4 7.6
clip s7  7 48 c7.mp4 4.6

printf "file 'c1.mp4'\nfile 'c2.mp4'\nfile 'c3.mp4'\nfile 'c4.mp4'\nfile 'c5.mp4'\nfile 'c5b.mp4'\nfile 'c6.mp4'\nfile 'c7.mp4'\n" > list.txt
ffmpeg -y -f concat -safe 0 -i list.txt -c copy marsstead-montage.mp4 -loglevel error
echo "DONE: media/montage/marsstead-montage.mp4"
