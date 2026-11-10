"""Normalise third-party coloring SVGs into the Malen template contract (1600x1200, black lines, white/transparent fills)."""
import re, sys, xml.etree.ElementTree as ET

SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", XLINK)
NAMED = {"black": "#000", "white": "#fff", "none": "none", "transparent": "none"}
UNITS = {"": 1, "px": 1, "pt": 96 / 72, "pc": 16, "mm": 96 / 25.4, "cm": 96 / 2.54, "in": 96}


def bw(value, kind):
    v = value.strip().lower()
    if v in ("none", "transparent", "inherit", "currentcolor") or not v:
        return v or value
    if v.startswith("url("):
        return "#fff" if kind == "fill" else "#000"
    v = NAMED.get(v, v)
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if not m:
        m2 = re.fullmatch(r"rgb\((\d+),\s*(\d+),\s*(\d+)\)", v)
        if not m2:
            return "#000" if kind == "stroke" else "#fff"
        r, g, b = (int(x) for x in m2.groups())
    else:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    if v == "none":
        return v
    lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    if kind == "stroke":
        return "#000"
    return "#fff" if lum >= 0.45 else "#000"


def transparent(v):
    try:
        return float(v.strip().rstrip("%")) == 0
    except ValueError:
        return False


def fix_style(style):
    out = []
    for decl in style.split(";"):
        if ":" not in decl:
            continue
        k, v = (s.strip() for s in decl.split(":", 1))
        if k in ("fill", "stroke"):
            v = bw(v, k)
        elif k in ("opacity", "fill-opacity", "stroke-opacity"):
            # Fully invisible stays invisible; partial transparency would read as grey, so it becomes opaque.
            if not transparent(v):
                continue
        elif k in ("filter", "mask", "clip-path"):
            continue
        out.append(f"{k}:{v}")
    return ";".join(out)


def length(s):
    m = re.fullmatch(r"\s*([\d.]+)\s*([a-z]*)\s*", s or "")
    if not m or m.group(2) == "%":
        return None
    return float(m.group(1)) * UNITS.get(m.group(2), 1)


def convert(src, dst, pad=50):
    tree = ET.parse(src)
    root = tree.getroot()
    # Keep only SVG elements and un-namespaced/xlink attributes: editor data (Inkscape, RDF, Illustrator's
    # <i:pgf> with an unresolved "&ns_ai;" namespace URI) makes strict SVG parsers reject the file.
    for parent in list(root.iter()):
        for child in list(parent):
            tag = child.tag if isinstance(child.tag, str) else ""
            if not tag.startswith("{%s}" % SVG) or tag.rsplit("}", 1)[1] in ("metadata", "title", "desc", "text", "image", "script", "foreignObject"):
                parent.remove(child)
    for el in root.iter():
        for k in list(el.attrib):
            if k.startswith("{") and not k.startswith("{%s}" % XLINK):
                del el.attrib[k]
                continue
            if k in ("fill", "stroke"):
                el.attrib[k] = bw(el.attrib[k], k)
            elif k in ("opacity", "fill-opacity", "stroke-opacity"):
                if not transparent(el.attrib[k]):
                    del el.attrib[k]
            elif k in ("filter", "mask", "clip-path"):
                del el.attrib[k]
            elif k == "style":
                el.attrib[k] = fix_style(el.attrib[k])
    vb = root.get("viewBox")
    if vb:
        x, y, w, h = (float(v) for v in re.split(r"[\s,]+", vb.strip()))
    else:
        w, h = length(root.get("width")), length(root.get("height"))
        x = y = 0
        if not (w and h):
            sys.exit(f"{src}: no usable size")
        # Content coordinates are user units (px); width/height may be in physical units.
        w0, h0 = float(re.match(r"[\d.]+", root.get("width")).group()), float(re.match(r"[\d.]+", root.get("height")).group())
        if root.get("width").strip().endswith(("mm", "cm", "in", "pt", "pc")):
            w, h = w0, h0  # Inkscape docs without viewBox use the bare number as user units
    for k in ("width", "height", "x", "y", "viewBox", "preserveAspectRatio", "version"):
        root.attrib.pop(k, None)
    root.set("viewBox", f"{x} {y} {w} {h}")
    root.set("x", str(pad)); root.set("y", str(pad))
    root.set("width", str(1600 - 2 * pad)); root.set("height", str(1200 - 2 * pad))
    root.set("preserveAspectRatio", "xMidYMid meet")
    inner = ET.tostring(root, encoding="unicode")
    inner = re.sub(r'^<svg xmlns="http://www.w3.org/2000/svg"( xmlns:xlink="http://www.w3.org/1999/xlink")?', "<svg", inner)
    out = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 1200" width="1600" height="1200">'
           + inner + "</svg>\n")
    open(dst, "w").write(out)


if __name__ == "__main__":
    for pair in sys.argv[1:]:
        s, d = pair.split("=")
        convert(s, d)
        print(d)
