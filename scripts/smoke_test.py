import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import create_app  # noqa: E402

# The terminal application markup lives at terminal.html. The repo root
# index.html is the marketing landing page.
INDEX = ROOT / "terminal.html"
LANDING = ROOT / "index.html"
CLIENT = ROOT / "src" / "clientApp.js"
APP_BOOTSTRAP = ROOT / "src" / "AppBootstrap.js"
REGISTRY = ROOT / "src" / "Registry.js"
API = ROOT / "src" / "api.js"
BACKEND = ROOT / "backend" / "app.py"
DATA = ROOT / "src" / "data.js"
STYLES = ROOT / "src" / "styles.css"
PACKAGE = ROOT / "package.json"
REQUIREMENTS = ROOT / "requirements.txt"
RENDERERS = [
    ROOT / "src" / "Renderers" / "BriefingRenderer.js",
    ROOT / "src" / "Renderers" / "CalculatorRenderer.js",
    ROOT / "src" / "Renderers" / "ChartRenderer.js",
    ROOT / "src" / "Renderers" / "Common.js",
    ROOT / "src" / "Renderers" / "HeatmapRenderer.js",
    ROOT / "src" / "Renderers" / "HomeRenderer.js",
    ROOT / "src" / "Renderers" / "MacroRenderer.js",
    ROOT / "src" / "Renderers" / "NewsRenderer.js",
    ROOT / "src" / "Renderers" / "OptionsRenderer.js",
    ROOT / "src" / "Renderers" / "PortfolioRenderer.js",
    ROOT / "src" / "Renderers" / "QuoteRenderer.js",
    ROOT / "src" / "Renderers" / "RulesRenderer.js",
    ROOT / "src" / "Renderers" / "ScreenerRenderer.js",
]

required_files = [INDEX, LANDING, CLIENT, APP_BOOTSTRAP, REGISTRY, API, BACKEND, DATA, STYLES, PACKAGE, REQUIREMENTS, *RENDERERS]
for file_path in required_files:
    assert file_path.exists(), f"Missing required file: {file_path}"

html = INDEX.read_text(encoding="utf-8")
for token in ["authModal", "loginForm", "signupForm", "terminalApp", "functionRow", "watchlistRail", "networkStatus", "clientApp.js"]:
    assert token in html, f"Expected token missing from terminal.html: {token}"

landing_html = LANDING.read_text(encoding="utf-8")
for token in ["The terminal.", "compare", "pricing", "whats-new", "Get Pro early access"]:
    assert token in landing_html, f"Expected token missing from index.html (landing): {token}"

client_code = CLIENT.read_text(encoding="utf-8")
for token in ["initializeApp", "DOMContentLoaded", "./AppBootstrap.js"]:
    assert token in client_code, f"Expected token missing from clientApp.js: {token}"

bootstrap_code = APP_BOOTSTRAP.read_text(encoding="utf-8")
for token in [
    "new WorkspaceController",
    "workspaceController?.initializeSession",
    "new DockingController",
    "dockingController?.initialize",
    "refreshAllData",
    "capturePriceChanges",
    "processCommand",
    "calculateBlackScholes",
    "calculateBond",
]:
    assert token in bootstrap_code, f"Expected token missing from AppBootstrap.js: {token}"

registry_code = REGISTRY.read_text(encoding="utf-8")
for token in [
    '"briefing"',
    '"home"',
    '"quote"',
    '"chart"',
    '"news"',
    '"screener"',
    '"heatmap"',
    '"portfolio"',
    '"macro"',
    '"options"',
    '"calculator"',
]:
    assert token in registry_code, f"Expected token missing from Registry.js: {token}"

api_code = API.read_text(encoding="utf-8")
for token in ["authApi", "workspaceApi", "marketApi", "apiRequest"]:
    assert token in api_code, f"Expected token missing from api.js: {token}"

backend_code = BACKEND.read_text(encoding="utf-8")
for token in ["/api/auth/signup", "/api/auth/login", "/api/workspace", "/api/market/quotes", "sqlite3"]:
    assert token in backend_code, f"Expected token missing from backend/app.py: {token}"

styles = STYLES.read_text(encoding="utf-8")
for token in ["prefers-reduced-motion", ".auth-modal", ".workspace-grid", ".function-row", ".command-shell"]:
    assert token in styles, f"Expected styling token missing from styles.css: {token}"

with tempfile.TemporaryDirectory() as tmp_dir:
    app = create_app({"TESTING": True, "DATABASE": str(Path(tmp_dir) / "test.db")})
    client = app.test_client()

    signup = client.post(
        "/api/auth/signup",
        data=json.dumps(
            {
                "firstName": "Ada",
                "lastName": "Lovelace",
                "email": "ada@example.com",
                "username": "adal",
                "password": "correcthorsebattery",
                "role": "Quant Developer",
            }
        ),
        content_type="application/json",
    )
    assert signup.status_code == 201, signup.get_data(as_text=True)
    payload = signup.get_json()
    assert payload["user"]["username"] == "adal"
    assert payload["workspace"]["watchlist"], "New workspace should have a default watchlist"

    workspace_update = client.put(
        "/api/workspace",
        data=json.dumps(
            {
                "watchlist": ["AAPL", "MSFT"],
                "alerts": [{"symbol": "AAPL", "operator": ">=", "threshold": 250, "status": "watching"}],
                "positions": [{"symbol": "MSFT", "shares": 2, "cost": 400}],
                "panelModules": {"1": "home", "2": "quote", "3": "chart", "4": "news"},
                "panelSymbols": {"1": "AAPL", "2": "MSFT", "3": "NVDA", "4": "QQQ"},
                "commandHistory": ["AAPL Q"],
            }
        ),
        content_type="application/json",
    )
    assert workspace_update.status_code == 200, workspace_update.get_data(as_text=True)
    assert workspace_update.get_json()["workspace"]["watchlist"] == ["AAPL", "MSFT"]

    session = client.get("/api/auth/session")
    assert session.status_code == 200, session.get_data(as_text=True)
    assert session.get_json()["workspace"]["commandHistory"] == ["AAPL Q"]

package = PACKAGE.read_text(encoding="utf-8")
assert '"start"' in package and '"check"' in package, "package scripts missing"

print("Smoke test passed: backend auth, saved workspace, and frontend shell look consistent.")
