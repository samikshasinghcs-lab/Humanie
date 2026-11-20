"""Generate a local-only HUMANIE secret in .env if one is not already present."""
from pathlib import Path
import secrets
env = Path(__file__).resolve().parents[1] / ".env"
if env.exists() and "HUMANIE_SECRET_KEY=" in env.read_text():
    print(".env already contains HUMANIE_SECRET_KEY; inspect it and keep it private.")
else:
    with env.open("a", encoding="utf-8") as f:
        f.write("\nHUMANIE_SECRET_KEY=" + secrets.token_urlsafe(48) + "\n")
    print("Generated a local HUMANIE_SECRET_KEY in .env. Do not commit or share this file.")
