"""固定版 MaiBot 环境安装；不修改现有配置、不接受协议、不启动服务。"""
from pathlib import Path, PurePosixPath

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tomllib

ROOT = Path(__file__).resolve().parent.parent
INSTANCE = ROOT / "maibot"
PINNED = json.loads((ROOT / "config/maibot-version.json").read_text(encoding="utf8"))
archive = Path(sys.argv[1])
if not (INSTANCE / "pyproject.toml").exists():
    if hashlib.sha256(archive.read_bytes()).hexdigest() != PINNED["archiveSha256"]:
        raise SystemExit("MaiBot archive SHA256 mismatch")
    if INSTANCE.exists() and any(INSTANCE.iterdir()):
        raise SystemExit("maibot 目录非空且缺少版本信息，不覆盖；请先检查目录。")
    INSTANCE.mkdir(exist_ok=True)
    with tarfile.open(archive) as source:
        for member in source.getmembers():
            parts = PurePosixPath(member.name).parts[1:]
            if not parts or member.issym() or member.islnk():
                continue
            if any(part in ("..", ".") or ":" in part or "\\" in part for part in parts):
                raise SystemExit("Unsafe archive entry")
            target = INSTANCE.joinpath(*parts).resolve()
            target.relative_to(INSTANCE.resolve())
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as content, target.open("wb") as destination:
                    shutil.copyfileobj(content, destination)
version = tomllib.loads((INSTANCE / "pyproject.toml").read_text(encoding="utf8"))["project"]["version"]
if "v" + version != PINNED["version"]:
    raise SystemExit("已存在的 MaiBot 版本与固定版本不一致，不自动覆盖。")

env = dict(os.environ, UV_CACHE_DIR=str(ROOT / ".tools/uv-cache"))
uv = shutil.which("uv")
if not uv:
    uv = str(ROOT / ".tools/uv-package/bin" / ("uv.exe" if os.name == "nt" else "uv"))
    if not Path(uv).exists():
        subprocess.run([sys.executable, "-m", "pip", "install", "--target", str(ROOT / ".tools/uv-package"), "--index-url", "https://pypi.org/simple", "uv==" + PINNED["uvVersion"]], env=env, check=True)
subprocess.run([uv, "sync", "--frozen", "--no-dev", "--no-install-project", "--python", sys.executable], cwd=INSTANCE, env=env, check=True)
patch = str(ROOT / PINNED["patch"])
check = subprocess.run(["git", "apply", "--check", patch], cwd=INSTANCE, capture_output=True)
if check.returncode == 0:
    subprocess.run(["git", "apply", patch], cwd=INSTANCE, check=True)
elif subprocess.run(["git", "apply", "--reverse", "--check", patch], cwd=INSTANCE, capture_output=True).returncode:
    raise SystemExit("兼容补丁不匹配；请检查 MaiBot 源码，不自动修改。")
python = INSTANCE / (".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python")
subprocess.run([str(python), "-m", "src.cli.tool", "init", "--directory", str(INSTANCE)], cwd=INSTANCE, env=env, check=True)
print("MaiBot 安装完成。填写本地 JSON 配置后执行 pnpm configure；首次运行请执行 pnpm maibot 并自行阅读、确认协议。")
