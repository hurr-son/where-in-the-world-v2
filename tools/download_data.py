"""Download the pipeline's source data into data/raw/.

Run from the repo root:  python tools/download_data.py
Files that are already there are skipped, so it is safe to re-run.
"""

import shutil
import urllib.request
import zipfile
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"

# (folder name in data/raw/, zip URL)
SOURCES = [
    # GHS-POP R2023A, epoch 2025, WGS84 30 arc-second (~1 km). CC BY 4.0, (c) European Union.
    (
        "GHS_POP_E2025_GLOBE_R2023A_4326_30ss",
        "https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_POP_GLOBE_R2023A/"
        "GHS_POP_E2025_GLOBE_R2023A_4326_30ss/V1-0/GHS_POP_E2025_GLOBE_R2023A_4326_30ss_V1_0.zip",
    ),
    # Natural Earth 1:10m admin-0 countries. Public domain.
    (
        "ne_10m_admin_0_countries",
        "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip",
    ),
]


def download(url: str, dest: Path) -> None:
    print(f"Downloading {url}")
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(url) as response, open(tmp, "wb") as f:
        shutil.copyfileobj(response, f)
    tmp.rename(dest)  # only a complete download gets the real name


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES:
        out_dir = RAW_DIR / name
        if out_dir.exists():
            print(f"Skipping {name} (already in {out_dir})")
            continue
        zip_path = RAW_DIR / f"{name}.zip"
        if not zip_path.exists():
            download(url, zip_path)
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(out_dir)
        zip_path.unlink()
        print(f"Extracted {name}")


if __name__ == "__main__":
    main()
