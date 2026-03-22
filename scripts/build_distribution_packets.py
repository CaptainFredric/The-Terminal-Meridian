from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "distribution-packets"

PACKETS: list[tuple[str, str, list[str]]] = [
    (
        "01-entry-and-manifests.md",
        "Entry shell and manifests",
        [
            "README.md",
            "index.html",
            "package.json",
            "requirements.txt",
            ".env.example",
            ".gitignore",
        ],
    ),
    (
        "02-frontend-styles.md",
        "Frontend styles",
        ["src/styles.css"],
    ),
    (
        "03-frontend-client-controller.md",
        "Frontend main controller",
        [
            "src/clientApp.js",
            "src/AppBootstrap.js",
        ],
    ),
    (
        "04-frontend-services-and-data.md",
        "Frontend services and data",
        [
            "src/api.js",
            "src/AppCore.js",
            "src/CommandLexer.js",
            "src/Controllers/CommandController.js",
            "src/Controllers/DockingController.js",
            "src/Controllers/WorkspaceController.js",
            "src/data.js",
            "src/LogicEngine.js",
            "src/Registry.js",
            "src/Renderers/ChartRenderer.js",
            "src/Renderers/Common.js",
            "src/Renderers/BriefingRenderer.js",
            "src/Renderers/CalculatorRenderer.js",
            "src/Renderers/HeatmapRenderer.js",
            "src/Renderers/HomeRenderer.js",
            "src/Renderers/MacroRenderer.js",
            "src/Renderers/NewsRenderer.js",
            "src/Renderers/OptionsRenderer.js",
            "src/Renderers/PortfolioRenderer.js",
            "src/Renderers/QuoteRenderer.js",
            "src/Renderers/RulesRenderer.js",
            "src/Renderers/ScreenerRenderer.js",
            "src/StateStore.js",
            "src/services.js",
            "src/marketService.js",
        ],
    ),
    (
        "05-supporting-frontend-files.md",
        "Supporting frontend files",
        [
            "src/app.js",
            "src/auth.js",
            "src/storage.js",
        ],
    ),
    (
        "06-backend.md",
        "Backend application",
        [
            "backend/app.py",
            "backend/__init__.py",
        ],
    ),
    (
        "07-test-and-tooling.md",
        "Testing and tooling",
        ["scripts/smoke_test.py"],
    ),
]

LANGUAGE_MAP = {
    ".html": "html",
    ".css": "css",
    ".js": "javascript",
    ".py": "python",
    ".json": "json",
    ".md": "markdown",
    ".txt": "text",
    "": "text",
}


def language_for(path: Path) -> str:
    return LANGUAGE_MAP.get(path.suffix.lower(), "text")


def build_packet(filename: str, title: str, relative_paths: list[str]) -> None:
    lines: list[str] = [
        f"# {title}",
        "",
        "Copy-paste packet generated from the current workspace state.",
        "",
        "## Included Files",
        "",
    ]

    for relative_path in relative_paths:
        lines.append(f"- `{relative_path}`")

    lines.extend(["", "---", ""])

    for relative_path in relative_paths:
        file_path = ROOT / relative_path
        language = language_for(file_path)
        content = file_path.read_text(encoding="utf-8")
        lines.extend(
            [
                f"## `{relative_path}`",
                "",
                f"````{language}",
                content.rstrip("\n"),
                "````",
                "",
            ]
        )

    (OUT_DIR / filename).write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def build_index() -> None:
    lines = [
        "# Distribution Packets",
        "",
        "These packets contain copy-paste-ready snapshots of the code used by `The-Terminal`.",
        "",
        "## Packets",
        "",
    ]

    for filename, title, relative_paths in PACKETS:
        lines.append(f"- `{filename}` — {title} ({len(relative_paths)} file{'s' if len(relative_paths) != 1 else ''})")

    lines.extend(
        [
            "",
            "## Regenerate",
            "",
            "```bash",
            "python3 scripts/build_distribution_packets.py",
            "```",
            "",
        ]
    )

    (OUT_DIR / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")


def build_all_in_one() -> None:
    seen: list[str] = []
    for _, _, relative_paths in PACKETS:
        for relative_path in relative_paths:
            if relative_path not in seen:
                seen.append(relative_path)

    lines = [
        "# All-In-One Code Packet",
        "",
        "Copy-paste-ready full code snapshot generated from the current workspace state.",
        "",
        "## Included Files",
        "",
    ]

    for relative_path in seen:
        lines.append(f"- `{relative_path}`")

    lines.extend(["", "---", ""])

    for relative_path in seen:
        file_path = ROOT / relative_path
        language = language_for(file_path)
        content = file_path.read_text(encoding="utf-8")
        lines.extend(
            [
                f"## `{relative_path}`",
                "",
                f"````{language}",
                content.rstrip("\n"),
                "````",
                "",
            ]
        )

    (OUT_DIR / "ALL_CODE.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, title, relative_paths in PACKETS:
        build_packet(filename, title, relative_paths)
    build_index()
    build_all_in_one()


if __name__ == "__main__":
    main()
