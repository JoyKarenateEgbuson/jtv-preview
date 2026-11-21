# Regenerating the watermark logo

If you replace public/logo.png, rebuild the small embedded copy used by the watermark:

    ffmpeg -i public/logo.png -vf scale=240:-1 wm-logo.png

then paste its base64 into src/lib/watermark-logo.ts (or ask Claude to redo it).
The favicon (src/app/icon.png) is the logo centred on a black square.
