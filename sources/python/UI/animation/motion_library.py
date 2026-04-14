"""
UI Forge Motion Library

Procedural motion functions for animated icons. Each motion function generates
transform values over normalized time and can be composed with other motions.

The library is intentionally data-driven: motions share common waveform,
envelope, and phase helpers so new presets can be added without rewriting the
entire sampling model.
"""

from __future__ import annotations

import math
import random
from typing import Any, Callable, Dict, List, Tuple


Transform = Dict[str, Any]
MotionFunc = Callable[[float, Dict[str, Any]], Transform]


def create_transform(
    translate: Tuple[float, float] = (0.0, 0.0),
    rotate: float = 0.0,
    scale: Tuple[float, float] = (1.0, 1.0),
) -> Transform:
    return {
        "translate": translate,
        "rotate": rotate,
        "scale": scale,
    }


def _phase_time(t: float, params: Dict[str, Any]) -> float:
    speed = float(params.get("speed", 1.0))
    phase = float(params.get("phase", 0.0))
    return (t * speed + phase) % 1.0


def _wave_value(t: float, params: Dict[str, Any], frequency_key: str = "frequency") -> float:
    frequency = float(params.get(frequency_key, 1.0))
    waveform = str(params.get("waveform", "sine")).lower()
    sample = _phase_time(t, params) * frequency
    cycle = sample % 1.0
    angle = 2 * math.pi * sample

    if waveform == "triangle":
        return 4.0 * abs(cycle - 0.5) - 1.0
    if waveform == "saw":
        return 2.0 * cycle - 1.0
    if waveform == "square":
        return 1.0 if cycle < 0.5 else -1.0
    if waveform == "cosine":
        return math.cos(angle)
    return math.sin(angle)


def _envelope(t: float, params: Dict[str, Any]) -> float:
    envelope = str(params.get("envelope", "none")).lower()
    amount = max(0.0, float(params.get("decay", params.get("falloff", 0.0))))

    if envelope == "none" or amount <= 0.0:
        return 1.0
    if envelope == "decay":
        return math.exp(-amount * t)
    if envelope == "fade-in":
        return min(1.0, t * amount)
    if envelope == "fade-out":
        return max(0.0, 1.0 - t * amount)
    if envelope == "pingpong":
        return 1.0 - abs(2.0 * t - 1.0) * amount
    return 1.0


def _seeded_noise(seed: int, index: int) -> float:
    rng = random.Random(seed + index * 7919)
    return rng.random() * 2.0 - 1.0


def _weighted_sines(t: float, frequency: float, phase: float, harmonics: List[Tuple[float, float]]) -> float:
    value = 0.0
    total = 0.0
    for weight, mul in harmonics:
        total += abs(weight)
        value += weight * math.sin(2 * math.pi * t * frequency * mul + phase * mul)
    return value / total if total else 0.0


def orbit(t: float, params: Dict[str, Any]) -> Transform:
    radius = float(params.get("radius", 10.0))
    speed = float(params.get("speed", 1.0))
    clockwise = bool(params.get("clockwise", True))
    ellipse = float(params.get("ellipse", 1.0))
    angle = 2 * math.pi * _phase_time(t, {"speed": speed, "phase": params.get("phase", 0.0)})
    if clockwise:
        angle = -angle
    return create_transform(translate=(radius * math.cos(angle), radius * ellipse * math.sin(angle)))


def float_motion(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 5.0))
    axis = str(params.get("axis", "vertical")).lower()
    offset = amplitude * _wave_value(t, params)
    if axis == "horizontal":
        return create_transform(translate=(offset, 0.0))
    if axis == "diagonal":
        return create_transform(translate=(offset, offset))
    return create_transform(translate=(0.0, offset))


def pulse(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.2))
    uniform = bool(params.get("uniform", True))
    base = 1.0 + intensity * _wave_value(t, params)
    if uniform:
        return create_transform(scale=(base, base))
    return create_transform(
        scale=(
            1.0 + intensity * _wave_value(t, params),
            1.0 + intensity * _wave_value(t, {**params, "phase": float(params.get("phase", 0.0)) + 0.25}),
        )
    )


def shake(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 2.0))
    frequency = float(params.get("frequency", 10.0))
    seed = int(params.get("seed", 42))
    sample_index = int(_phase_time(t, params) * frequency * 120)
    x = intensity * _seeded_noise(seed, sample_index)
    y = intensity * _seeded_noise(seed + 17, sample_index)
    return create_transform(translate=(x, y))


def elastic(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 1.0))
    frequency = float(params.get("frequency", 3.0))
    axis = str(params.get("axis", "scale")).lower()
    time_value = _phase_time(t, params)
    if time_value in (0.0, 1.0):
        value = 1.0
    else:
        period = max(0.05, 1.0 / max(frequency, 0.01))
        shift = period / 4.0
        value = amplitude * math.pow(2.0, -10.0 * time_value) * math.sin((time_value - shift) * (2.0 * math.pi) / period) + 1.0
    if axis == "translate_x":
        return create_transform(translate=(value * 10.0, 0.0))
    if axis == "translate_y":
        return create_transform(translate=(0.0, value * 10.0))
    if axis == "rotate":
        return create_transform(rotate=value * 120.0)
    return create_transform(scale=(value, value))


def pendulum(t: float, params: Dict[str, Any]) -> Transform:
    angle = float(params.get("angle", 15.0))
    return create_transform(rotate=angle * _wave_value(t, params))


def wobble(t: float, params: Dict[str, Any]) -> Transform:
    angle = float(params.get("angle", 20.0))
    decay = float(params.get("decay", 2.0))
    value = angle * math.exp(-decay * _phase_time(t, params)) * _wave_value(t, {**params, "waveform": "sine"})
    return create_transform(rotate=value)


def figure8(t: float, params: Dict[str, Any]) -> Transform:
    size = float(params.get("size", 10.0))
    speed = float(params.get("speed", 1.0))
    angle = 2 * math.pi * _phase_time(t, {"speed": speed, "phase": params.get("phase", 0.0)})
    scale = 2.0 / (3.0 - math.cos(2.0 * angle))
    return create_transform(translate=(size * scale * math.cos(angle), size * scale * math.sin(2.0 * angle) / 2.0))


def heartbeat(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.15))
    bpm = float(params.get("bpm", 60.0))
    phase = (_phase_time(t, params) * bpm / 60.0) % 1.0
    if phase < 0.16:
        local = phase / 0.16
        scale = 1.0 + intensity * math.sin(math.pi * local)
    elif phase < 0.32:
        local = (phase - 0.16) / 0.16
        scale = 1.0 + intensity * 0.72 * math.sin(math.pi * local)
    else:
        scale = 1.0
    return create_transform(scale=(scale, scale))


def glitch(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 5.0))
    frequency = float(params.get("frequency", 5.0))
    seed = int(params.get("seed", 42))
    glitch_index = int(_phase_time(t, params) * frequency * 12)
    rng = random.Random(seed + glitch_index)
    if rng.random() < float(params.get("chance", 0.3)):
        return create_transform(translate=(intensity * (rng.random() * 2 - 1), intensity * (rng.random() * 2 - 1)))
    return create_transform()


def bounce(t: float, params: Dict[str, Any]) -> Transform:
    height = float(params.get("height", 20.0))
    bounces = max(1, int(params.get("bounces", 3)))
    axis = str(params.get("axis", "vertical")).lower()
    bounce_t = (_phase_time(t, params) * bounces) % 1.0
    offset = height * abs(math.sin(math.pi * bounce_t)) * (1.0 - t * 0.5)
    if axis == "horizontal":
        return create_transform(translate=(offset, 0.0))
    return create_transform(translate=(0.0, -offset))


def tumble(t: float, params: Dict[str, Any]) -> Transform:
    speed = float(params.get("speed", 2.0))
    direction = str(params.get("axis", "clockwise")).lower()
    angle = 360.0 * _phase_time(t, {"speed": speed, "phase": params.get("phase", 0.0)})
    return create_transform(rotate=(-angle if direction == "counterclockwise" else angle))


def strobe(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.5))
    phase = (_phase_time(t, params) * float(params.get("frequency", 10.0))) % 1.0
    scale = 1.0 if phase < 0.5 else (1.0 - intensity)
    return create_transform(scale=(scale, scale))


def corkscrew(t: float, params: Dict[str, Any]) -> Transform:
    radius = float(params.get("radius", 10.0))
    height = float(params.get("height", 20.0))
    rotations = float(params.get("rotations", 2.0))
    sample = _phase_time(t, params)
    angle = 2.0 * math.pi * sample * rotations
    return create_transform(translate=(radius * math.cos(angle) * (1.0 - sample), height * (sample - 0.5)))


def shiver(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 1.0))
    frequency = float(params.get("frequency", 20.0))
    sample = _phase_time(t, params)
    return create_transform(
        translate=(
            intensity * math.sin(2.0 * math.pi * sample * frequency),
            intensity * math.cos(2.0 * math.pi * sample * frequency * 1.3),
        )
    )


def sway(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 5.0))
    angle = float(params.get("angle", 10.0))
    value = _wave_value(t, params)
    return create_transform(translate=(amplitude * value, 0.0), rotate=angle * value)


def lissajous(t: float, params: Dict[str, Any]) -> Transform:
    size = float(params.get("size", 10.0))
    a = float(params.get("a", 3.0))
    b = float(params.get("b", 2.0))
    delta = float(params.get("delta", math.pi / 2))
    angle = 2.0 * math.pi * _phase_time(t, params)
    return create_transform(translate=(size * math.sin(a * angle + delta), size * math.sin(b * angle)))


def flip(t: float, params: Dict[str, Any]) -> Transform:
    axis = str(params.get("axis", "horizontal")).lower()
    speed = float(params.get("speed", 1.0))
    scale_factor = math.cos(math.pi * _phase_time(t, {"speed": speed, "phase": params.get("phase", 0.0)}))
    if axis == "vertical":
        return create_transform(scale=(1.0, scale_factor))
    return create_transform(scale=(scale_factor, 1.0))


def tremor(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 2.0))
    frequencies = params.get("frequencies", [5, 10, 15])
    x = 0.0
    y = 0.0
    for i, freq in enumerate(frequencies):
        weight = 1.0 / (i + 1)
        x += weight * intensity * math.sin(2.0 * math.pi * _phase_time(t, params) * freq)
        y += weight * intensity * math.cos(2.0 * math.pi * _phase_time(t, params) * freq * 1.2)
    x /= max(1, len(frequencies))
    y /= max(1, len(frequencies))
    return create_transform(translate=(x, y))


def scan(t: float, params: Dict[str, Any]) -> Transform:
    distance = float(params.get("distance", 20.0))
    axis = str(params.get("axis", "horizontal")).lower()
    reverse = bool(params.get("reverse", False))
    progress = 1.0 - _phase_time(t, params) if reverse else _phase_time(t, params)
    offset = distance * (progress - 0.5) * 2.0
    if axis == "vertical":
        return create_transform(translate=(0.0, offset))
    return create_transform(translate=(offset, 0.0))


def warp(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.3))
    sample = _phase_time(t, params)
    sx = 1.0 + intensity * math.sin(2.0 * math.pi * sample * float(params.get("frequency", 2.0)))
    sy = 1.0 + intensity * math.sin(2.0 * math.pi * sample * float(params.get("frequency", 2.0)) + math.pi / 2.0)
    return create_transform(scale=(sx, sy))


def drift(t: float, params: Dict[str, Any]) -> Transform:
    distance = float(params.get("distance", 10.0))
    frequency = float(params.get("frequency", 0.5))
    seed = int(params.get("seed", 42))
    rng = random.Random(seed)
    phase1 = rng.random() * 2.0 * math.pi
    phase2 = rng.random() * 2.0 * math.pi
    sample = _phase_time(t, params)
    x = distance * (
        0.5 * math.sin(2.0 * math.pi * sample * frequency + phase1)
        + 0.3 * math.sin(2.0 * math.pi * sample * frequency * 1.7 + phase2)
        + 0.2 * math.sin(2.0 * math.pi * sample * frequency * 2.3)
    )
    y = distance * (
        0.5 * math.cos(2.0 * math.pi * sample * frequency + phase1)
        + 0.3 * math.cos(2.0 * math.pi * sample * frequency * 1.5 + phase2)
        + 0.2 * math.cos(2.0 * math.pi * sample * frequency * 2.1)
    )
    return create_transform(translate=(x, y))


def bob(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 6.0))
    offset = -abs(_wave_value(t, params)) * amplitude
    return create_transform(translate=(0.0, offset))


def hover(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 4.0))
    tilt = float(params.get("tilt", 4.0))
    sample = _weighted_sines(_phase_time(t, params), float(params.get("frequency", 1.0)), float(params.get("phase", 0.0)), [(1.0, 1.0), (0.35, 2.1)])
    return create_transform(translate=(amplitude * sample, -amplitude * 0.75 * sample), rotate=tilt * sample)


def breath(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.08))
    inhale_bias = float(params.get("inhale_bias", 0.65))
    phase = (_phase_time(t, params) * float(params.get("frequency", 1.0))) % 1.0
    if phase < inhale_bias:
        local = phase / max(inhale_bias, 1e-6)
        scale = 1.0 + intensity * local
    else:
        local = (phase - inhale_bias) / max(1.0 - inhale_bias, 1e-6)
        scale = 1.0 + intensity * (1.0 - local)
    return create_transform(scale=(scale, scale))


def jelly(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.22))
    freq = float(params.get("frequency", 2.5))
    env = _envelope(t, {"envelope": params.get("envelope", "decay"), "decay": params.get("decay", 2.5)})
    sample = math.sin(2.0 * math.pi * _phase_time(t, params) * freq) * env
    return create_transform(scale=(1.0 + intensity * sample, 1.0 - intensity * sample * 0.9))


def swing(t: float, params: Dict[str, Any]) -> Transform:
    angle = float(params.get("angle", 18.0))
    return create_transform(rotate=angle * _wave_value(t, {**params, "waveform": params.get("waveform", "sine")}))


def snap(t: float, params: Dict[str, Any]) -> Transform:
    angle = float(params.get("angle", 24.0))
    distance = float(params.get("distance", 8.0))
    phase = (_phase_time(t, params) * float(params.get("frequency", 2.0))) % 1.0
    if phase < 0.2:
        local = phase / 0.2
        return create_transform(translate=(distance * local, 0.0), rotate=angle * local)
    if phase < 0.32:
        local = (phase - 0.2) / 0.12
        return create_transform(translate=(distance * (1.0 - local * 1.4), 0.0), rotate=angle * (1.0 - local * 1.6))
    return create_transform()


def reveal(t: float, params: Dict[str, Any]) -> Transform:
    axis = str(params.get("axis", "vertical")).lower()
    start = float(params.get("start_scale", 0.25))
    progress = max(0.0, min(1.0, _phase_time(t, params)))
    scale = start + (1.0 - start) * progress
    if axis == "horizontal":
        return create_transform(scale=(scale, 1.0))
    if axis == "both":
        return create_transform(scale=(scale, scale))
    return create_transform(scale=(1.0, scale))


def blink(t: float, params: Dict[str, Any]) -> Transform:
    closed = float(params.get("closed_scale", 0.15))
    frequency = float(params.get("frequency", 3.0))
    duty = float(params.get("duty_cycle", 0.16))
    phase = (_phase_time(t, params) * frequency) % 1.0
    if phase < duty:
        local = phase / max(duty, 1e-6)
        scale_y = 1.0 - (1.0 - closed) * math.sin(math.pi * local)
    else:
        scale_y = 1.0
    return create_transform(scale=(1.0, scale_y))


def pop(t: float, params: Dict[str, Any]) -> Transform:
    overshoot = float(params.get("overshoot", 0.24))
    phase = (_phase_time(t, params) * float(params.get("frequency", 2.0))) % 1.0
    if phase < 0.18:
        local = phase / 0.18
        scale = 0.7 + local * (1.0 + overshoot - 0.7)
    elif phase < 0.36:
        local = (phase - 0.18) / 0.18
        scale = 1.0 + overshoot * (1.0 - local)
    else:
        scale = 1.0
    return create_transform(scale=(scale, scale))


def twitch(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 3.0))
    angle = float(params.get("angle", 8.0))
    frequency = float(params.get("frequency", 6.0))
    phase = (_phase_time(t, params) * frequency) % 1.0
    if phase < 0.14:
        sample = math.sin(math.pi * phase / 0.14)
        return create_transform(translate=(intensity * sample, -intensity * 0.5 * sample), rotate=angle * sample)
    return create_transform()


def helix(t: float, params: Dict[str, Any]) -> Transform:
    radius = float(params.get("radius", 8.0))
    rotations = float(params.get("rotations", 2.5))
    lift = float(params.get("lift", 10.0))
    sample = _phase_time(t, params)
    angle = 2.0 * math.pi * sample * rotations
    return create_transform(translate=(radius * math.cos(angle), lift * math.sin(angle * 0.5)))


def spiral(t: float, params: Dict[str, Any]) -> Transform:
    radius = float(params.get("radius", 12.0))
    rotations = float(params.get("rotations", 2.0))
    inward = bool(params.get("inward", False))
    sample = _phase_time(t, params)
    radial = radius * (sample if not inward else (1.0 - sample))
    angle = 2.0 * math.pi * sample * rotations
    return create_transform(translate=(radial * math.cos(angle), radial * math.sin(angle)), rotate=math.degrees(angle) * 0.2)


def zigzag(t: float, params: Dict[str, Any]) -> Transform:
    amplitude = float(params.get("amplitude", 10.0))
    travel = float(params.get("travel", 10.0))
    cycles = float(params.get("cycles", 3.0))
    sample = _phase_time(t, params)
    x = amplitude * (4.0 * abs((sample * cycles) % 1.0 - 0.5) - 1.0)
    y = travel * (sample - 0.5) * 2.0
    return create_transform(translate=(x, y))


def ricochet(t: float, params: Dict[str, Any]) -> Transform:
    distance = float(params.get("distance", 12.0))
    bounces = max(1, int(params.get("bounces", 4)))
    sample = _phase_time(t, params)
    segment = (sample * bounces) % 1.0
    damp = 1.0 - sample * 0.7
    x = distance * damp * (1.0 if int(sample * bounces) % 2 == 0 else -1.0) * math.sin(math.pi * segment)
    y = -distance * damp * abs(math.sin(math.pi * segment))
    return create_transform(translate=(x, y), rotate=10.0 * damp * math.sin(2.0 * math.pi * sample * bounces))


def swirl(t: float, params: Dict[str, Any]) -> Transform:
    radius = float(params.get("radius", 8.0))
    turns = float(params.get("turns", 1.5))
    sample = _phase_time(t, params)
    angle = 2.0 * math.pi * sample * turns
    ramp = math.sin(math.pi * sample)
    return create_transform(translate=(radius * ramp * math.cos(angle), radius * ramp * math.sin(angle)), rotate=math.degrees(angle) * 0.35)


def ripple(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 0.14))
    frequency = float(params.get("frequency", 3.0))
    sample = _phase_time(t, params)
    sx = 1.0 + intensity * math.sin(2.0 * math.pi * sample * frequency)
    sy = 1.0 + intensity * math.sin(2.0 * math.pi * sample * frequency + math.pi)
    return create_transform(scale=(sx, sy))


def ping(t: float, params: Dict[str, Any]) -> Transform:
    max_scale = float(params.get("max_scale", 1.3))
    sample = _phase_time(t, params)
    env = math.exp(-3.0 * sample)
    scale = 1.0 + (max_scale - 1.0) * math.sin(math.pi * sample) * env
    return create_transform(scale=(scale, scale))


def jitter(t: float, params: Dict[str, Any]) -> Transform:
    intensity = float(params.get("intensity", 1.5))
    seed = int(params.get("seed", 42))
    sample_index = int(_phase_time(t, params) * float(params.get("frequency", 18.0)) * 64)
    x = intensity * _seeded_noise(seed, sample_index)
    y = intensity * _seeded_noise(seed + 101, sample_index)
    angle = float(params.get("angle", 4.0)) * _seeded_noise(seed + 211, sample_index)
    return create_transform(translate=(x, y), rotate=angle)


def glide(t: float, params: Dict[str, Any]) -> Transform:
    distance = float(params.get("distance", 12.0))
    axis = str(params.get("axis", "horizontal")).lower()
    sample = 0.5 - 0.5 * math.cos(2.0 * math.pi * _phase_time(t, params))
    offset = (sample - 0.5) * 2.0 * distance
    if axis == "vertical":
        return create_transform(translate=(0.0, offset))
    if axis == "diagonal":
        return create_transform(translate=(offset, -offset))
    return create_transform(translate=(offset, 0.0))


def orbital_pulse(t: float, params: Dict[str, Any]) -> Transform:
    orbit_transform = orbit(t, params)
    pulse_transform = pulse(t, {**params, "intensity": params.get("intensity", 0.12), "frequency": params.get("pulse_frequency", params.get("frequency", 1.0))})
    return create_transform(
        translate=orbit_transform["translate"],
        rotate=orbit_transform["rotate"],
        scale=pulse_transform["scale"],
    )


MOTION_REGISTRY: Dict[str, MotionFunc] = {
    "orbit": orbit,
    "float": float_motion,
    "pulse": pulse,
    "shake": shake,
    "elastic": elastic,
    "pendulum": pendulum,
    "wobble": wobble,
    "figure8": figure8,
    "heartbeat": heartbeat,
    "glitch": glitch,
    "bounce": bounce,
    "tumble": tumble,
    "strobe": strobe,
    "corkscrew": corkscrew,
    "shiver": shiver,
    "sway": sway,
    "lissajous": lissajous,
    "flip": flip,
    "tremor": tremor,
    "scan": scan,
    "warp": warp,
    "drift": drift,
    "bob": bob,
    "hover": hover,
    "breath": breath,
    "jelly": jelly,
    "swing": swing,
    "snap": snap,
    "reveal": reveal,
    "blink": blink,
    "pop": pop,
    "twitch": twitch,
    "helix": helix,
    "spiral": spiral,
    "zigzag": zigzag,
    "ricochet": ricochet,
    "swirl": swirl,
    "ripple": ripple,
    "ping": ping,
    "jitter": jitter,
    "glide": glide,
    "orbital_pulse": orbital_pulse,
}


def get_motion_function(motion_type: str) -> MotionFunc | None:
    return MOTION_REGISTRY.get(motion_type.lower())


def list_motion_types() -> List[str]:
    return list(MOTION_REGISTRY.keys())


def compose_motions(t: float, motion_configs: List[Tuple[str, Dict[str, Any]]]) -> Transform:
    total_translate_x = 0.0
    total_translate_y = 0.0
    total_rotate = 0.0
    total_scale_x = 1.0
    total_scale_y = 1.0

    for motion_type, params in motion_configs:
        motion_func = get_motion_function(motion_type)
        if motion_func is None:
            continue
        transform = motion_func(t, params)
        tx, ty = transform["translate"]
        sx, sy = transform["scale"]
        total_translate_x += tx
        total_translate_y += ty
        total_rotate += transform["rotate"]
        total_scale_x *= sx
        total_scale_y *= sy

    return create_transform(
        translate=(total_translate_x, total_translate_y),
        rotate=total_rotate,
        scale=(total_scale_x, total_scale_y),
    )


__all__ = [
    "MOTION_REGISTRY",
    "compose_motions",
    "create_transform",
    "get_motion_function",
    "list_motion_types",
]
