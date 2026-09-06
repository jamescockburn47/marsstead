# Third-party notices

Marsstead's GPL-3.0-or-later grant covers its original software, not ownership of
third-party components or scientific data. Existing third-party terms and notices
continue to apply. This file records the current principal dependencies and baked
data; the research roadmap in docs/DATA.md also includes proposed future inputs.

## Three.js

Three.js and its included addons are used by the browser client under the MIT
licence. Copyright © 2010–2026 three.js authors. The complete upstream permission
and warranty notice is retained in [LICENSES/three-MIT.txt](LICENSES/three-MIT.txt).
Retain that notice when redistributing Three.js, including in a bundled client.

Upstream: https://github.com/mrdoob/three.js

## Build and verification dependencies

Vite's core is MIT-licensed; Playwright Core is Apache-2.0-licensed. Their packages
and transitive dependencies retain their own licence files and notices. Consult
the exact versions in package-lock.json and the licence files supplied with those
packages when redistributing the tools. The project's GPL does not replace them.

## Mars topography

Source: Mars Global Surveyor, Mars Orbiter Laser Altimeter (MOLA), Mission Experiment
Gridded Data Record (MEGDR), product MGS-M-MOLA-5-MEGDR-L3-V1.0, four pixels per
degree, topography file megt90n000cb.img. Provided through NASA's Planetary Data
System Geosciences Node; transformed into the generated elevation tables by
scripts/build-marsdata.mjs. Procedural surface detail and game scaling are
Marsstead's additions, not measured terrain detail.

Data: https://pds-geosciences.wustl.edu/missions/mgs/megdr.html

NASA's science-data policy applies CC0 to NASA-led mission data unless a data file
has a restrictive notice or licence. The project records this MOLA input as public
domain. Credit NASA, the MOLA science team and the PDS Geosciences Node when reusing
these tables; the underlying data are not relicensed under the GPL.

Policy: https://science.data.nasa.gov/about/license

## Planetary names

Source: Gazetteer of Planetary Nomenclature, maintained by USGS for IAU-approved
planetary names; Mars feature centres from MARS_nomenclature_center_pts.dbf.
Filtered feature names, coordinates and diameters are baked by the data builder.
Credit: U.S. Geological Survey and the IAU Working Group for Planetary System
Nomenclature. USGS-produced data are in the U.S. public domain; USGS requests
acknowledgement. The underlying data are not relicensed under the GPL.

Data: https://planetarynames.wr.usgs.gov/

Policy: https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted

## Vehicle-dynamics acknowledgement

The buggy's vehicle dynamics follow the DFA-1 arcade-car model from Dan's Dune
Flip Arena, adapted to Mars gravity and reimplemented procedurally, as recorded
in README.md and src/buggy.js. Used with permission; credit Dan. This acknowledgement
does not purport to relicense Dune Flip Arena or grant rights to its separate code.

Original project reference: https://github.com/golnuggit/dune-flip-arena
