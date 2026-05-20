"""
Audio Environment Demo (POC v2 — convolution-based)
────────────────────────────────────────────────────
Generates synthetic IRs (impulse responses) shaped like real-room IRs —
filtered noise bursts with exponential decay — and convolves the voice with
them via FFmpeg's `afir` filter. Sounds far more natural than `aecho`
because it produces diffuse decay, not discrete delayed copies.

The synthetic IRs are saved as .wav so they can later be swapped for real
recordings (OpenAir Library, EchoThief, etc.) without changing the chain.

Usage:
    python scripts/audio_env_demo.py <input.wav>

Outputs to /tmp/audio_env_demo/:
    00_dry.wav       — original (passthrough)
    01_taller.wav    — small workshop (short tight tail ~250ms)
    02_playa.wav     — open-air, no real reverb (very short tail + heavy HF rolloff + waves)
    03_calle.wav     — street between buildings (medium tail ~600ms + traffic rumble)

    irs/*.wav        — generated impulse responses (drop-in replaceable)
"""

import subprocess
import sys
from pathlib import Path

OUT_DIR = Path("/tmp/audio_env_demo")
IR_DIR = OUT_DIR / "irs"
OUT_DIR.mkdir(parents=True, exist_ok=True)
IR_DIR.mkdir(parents=True, exist_ok=True)


# ── IR generation specs ──────────────────────────────────────
# Each IR is a noise burst shaped like a real-room IR: an exponential
# decay envelope + a lowpass filter (real rooms eat highs fast in the tail)
# + a tiny "early reflection" cluster at the start.
#
# These are drop-in replaceable: swap the .wav with a real IR from
# OpenAir / EchoThief / Voxengo and the chain doesn't change.

IR_SPECS = {
    "taller": {
        # Small workshop ~5x4m: tight tail, moderate HF, subtle reflections
        "tail_seconds": 0.45,
        "lowpass_hz": 6500,        # tail is darker than direct
        "predelay_ms": 12,
        "decay_curve": "exp",
        "wet_db": -14,             # how loud the wet (reverbed) signal is vs dry
    },
    "playa": {
        # Open beach: NO reverb, just air absorption + tiny ground reflection
        "tail_seconds": 0.10,
        "lowpass_hz": 4500,
        "predelay_ms": 5,
        "decay_curve": "exp_fast",
        "wet_db": -22,             # very subtle — outdoor barely reflects voice
    },
    "calle": {
        # Street between buildings ~10m wide: medium tail, urban diffusion
        "tail_seconds": 0.85,
        "lowpass_hz": 5500,
        "predelay_ms": 25,
        "decay_curve": "exp",
        "wet_db": -16,
    },
}


# ── Environment presets ──────────────────────────────────────
# Voice is convolved with the IR via afir, then EQ'd, then ambient bed
# is layered. Wet/dry ratio is controlled by `wet_db` in IR_SPECS.

PRESETS = {
    "taller": {
        "ir": "taller",
        # Light EQ to suggest enclosed space, mild compression for lavalier feel
        "voice_eq": (
            "highpass=f=110,"
            "lowpass=f=11000,"
            "equalizer=f=3000:width_type=h:width=2000:g=1.5,"
            "compand=attacks=0.05:decays=0.3:points=-90/-90|-30/-15|-10/-8|0/-7"
        ),
        # Workshop ambient: low brown rumble (HVAC) + faint mid bandpass
        "ambient_filter": (
            "anoisesrc=color=brown:amplitude=0.15:duration={dur}[brown];"
            "anoisesrc=color=pink:amplitude=0.05:duration={dur},"
            "bandpass=f=1200:w=400[mid];"
            "[brown][mid]amix=inputs=2:duration=longest[bed];"
            "[bed]volume=-30dB[ambout]"
        ),
    },
    "playa": {
        "ir": "playa",
        # Heavy HF rolloff (air absorption), mid suck (open feel)
        "voice_eq": (
            "highpass=f=130,"
            "lowpass=f=6800,"
            "equalizer=f=2500:width_type=h:width=1500:g=-1.5,"
            "compand=attacks=0.03:decays=0.2:points=-90/-90|-25/-12|-5/-5|0/-4"
        ),
        "ambient_filter": (
            "anoisesrc=color=brown:amplitude=0.32:duration={dur},"
            "lowpass=f=600,"
            "tremolo=f=0.22:d=0.7[waves];"
            "anoisesrc=color=pink:amplitude=0.07:duration={dur},"
            "highpass=f=2200,"
            "lowpass=f=6000[wind];"
            "[waves][wind]amix=inputs=2:duration=longest[bed];"
            "[bed]volume=-20dB[ambout]"
        ),
    },
    "calle": {
        "ir": "calle",
        "voice_eq": (
            "highpass=f=140,"
            "lowpass=f=9000,"
            "equalizer=f=4000:width_type=h:width=1500:g=1.0,"
            "compand=attacks=0.05:decays=0.3:points=-90/-90|-30/-15|-10/-8|0/-7"
        ),
        "ambient_filter": (
            "anoisesrc=color=brown:amplitude=0.22:duration={dur},"
            "lowpass=f=350[rumble];"
            "anoisesrc=color=pink:amplitude=0.07:duration={dur},"
            "bandpass=f=2200:w=1500[hum];"
            "[rumble][hum]amix=inputs=2:duration=longest[bed];"
            "[bed]volume=-26dB[ambout]"
        ),
    },
}


def generate_ir(name: str, spec: dict) -> Path:
    """
    Generate a synthetic IR shaped like a real-room IR:
      pink noise * exponential decay envelope, then lowpass'd, then optional
      predelay (silence at start). Stored as 16-bit mono 44.1kHz wav.
    """
    out = IR_DIR / f"{name}.wav"
    tail = spec["tail_seconds"]
    lp = spec["lowpass_hz"]
    predelay = spec["predelay_ms"] / 1000.0
    curve_pow = 8 if spec["decay_curve"] == "exp" else 18  # higher = faster decay

    # Build the IR via filter_complex:
    #   pink noise of the right duration -> aevalsrc envelope * sample
    # We use `volume=eval=frame` with an exponential expression on T (time).
    # Simpler alt: generate noise, fade out exponentially using afade=curve=exp.
    fc = (
        f"anoisesrc=color=pink:amplitude=0.9:duration={tail}:sample_rate=44100,"
        f"lowpass=f={lp},"
        f"afade=t=out:st=0:d={tail}:curve=exp,"
        f"volume=2.0,"  # boost a touch since fades attenuate
        f"adelay={int(predelay*1000)}|{int(predelay*1000)}"
    )
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-filter_complex", fc, "-map", "[out]" if False else "0:a",  # noop, just keep
        "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
        "-t", f"{tail + predelay + 0.05}",  # cap length
        str(out),
    ]
    # The simpler form: build via -filter_complex output -> use -f lavfi style
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "lavfi",
        "-i", f"anoisesrc=color=pink:amplitude=0.9:duration={tail}:sample_rate=44100",
        "-af", f"lowpass=f={lp},afade=t=out:st=0:d={tail}:curve=exp,volume=3.0,adelay={int(predelay*1000)}",
        "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
        "-t", f"{tail + predelay + 0.05}",
        str(out),
    ]
    _ = curve_pow  # reserved for future shape tweaks
    subprocess.run(cmd, check=True)
    return out


def get_duration(path: Path) -> float:
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=nw=1:nk=1", str(path),
    ])
    return float(out.decode().strip())


def render_dry(input_path: Path, output: Path):
    """Just normalize/resample the input as the dry baseline."""
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(input_path),
        "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def render_preset(input_path: Path, preset_name: str, output: Path, ir_path: Path):
    """
    Filter graph:
      [0:a] -> EQ chain                    -> [dry_path]
      [dry_path] split -> wet_in           -> afir(IR) -> wet_db gain -> [wet_path]
      [dry_path] [wet_path] amix           -> [voice]
      anoisesrc(...) -> ambient_filter     -> [ambout]
      [voice] [ambout] amix                -> loudnorm -> output
    """
    cfg = PRESETS[preset_name]
    ir_spec = IR_SPECS[cfg["ir"]]
    duration = get_duration(input_path)

    # Convert dB to linear gain for the wet channel
    wet_gain = 10 ** (ir_spec["wet_db"] / 20.0)
    ambient_chain = cfg["ambient_filter"].format(dur=duration)

    fc = (
        # EQ on the dry voice
        f"[0:a]{cfg['voice_eq']},asplit=2[dry][wet_in];"
        # Convolution: wet_in convolves with the IR (input #1 in the cmd below)
        # afir's wet/dry param is set to wet=1 (full wet) and we attenuate after.
        f"[wet_in][1:a]afir=dry=0:wet=1:length=1:gtype=peak[wet_conv];"
        f"[wet_conv]volume={wet_gain}[wet];"
        # Mix dry + wet at unity (wet already attenuated to taste)
        f"[dry][wet]amix=inputs=2:duration=first:weights=1.0 1.0[voice];"
        # Ambient bed (fully synthesized chain)
        f"{ambient_chain};"
        # Final mix: voice + ambient → loudnorm
        f"[voice][ambout]amix=inputs=2:duration=first:weights=1.0 0.85,"
        f"loudnorm=I=-16:TP=-1.5:LRA=11"
    )

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", str(input_path),
        "-i", str(ir_path),
        "-filter_complex", fc,
        "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
        str(output),
    ]
    subprocess.run(cmd, check=True)


def main(argv):
    if len(argv) < 2:
        print("Usage: python audio_env_demo.py <input_audio_file>")
        sys.exit(1)

    input_path = Path(argv[1])
    if not input_path.exists():
        print(f"File not found: {input_path}")
        sys.exit(1)

    print(f"Source: {input_path}")
    duration = get_duration(input_path)
    print(f"Duration: {duration:.2f}s")
    print(f"Output dir: {OUT_DIR}")
    print()

    # Generate impulse responses (synthetic, drop-in replaceable)
    print("Generating IRs...")
    ir_paths: dict[str, Path] = {}
    for name, spec in IR_SPECS.items():
        ir_paths[name] = generate_ir(name, spec)
        print(f"  ✓ irs/{name}.wav  (tail={spec['tail_seconds']}s, lp={spec['lowpass_hz']}Hz)")
    print()

    dry_out = OUT_DIR / "00_dry.wav"
    render_dry(input_path, dry_out)
    print(f"  ✓ {dry_out.name} (dry baseline)")

    for i, name in enumerate(["taller", "playa", "calle"], start=1):
        out = OUT_DIR / f"{i:02d}_{name}.wav"
        render_preset(input_path, name, out, ir_paths[PRESETS[name]["ir"]])
        print(f"  ✓ {out.name}")

    print()
    print("Listen with:")
    for f in sorted(OUT_DIR.glob("*.wav")):
        print(f"  afplay '{f}'")


if __name__ == "__main__":
    main(sys.argv)
